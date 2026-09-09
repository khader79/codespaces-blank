import { getServerDataClient } from "@/lib/supabase-admin";

const supabase = getServerDataClient();

const COST_RATIO = 0.6;

export interface WarehouseRow {
  id: number;
  store_id: number;
  name: string;
  location: string | null;
  is_main: boolean;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: number | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}

const toNumber = (value: unknown): number => Number(value ?? 0);

const STORE_TENANT_CACHE_TTL_MS = 300_000;
const storeTenantCache = new Map<number, { tenantId: number; at: number }>();

/** Resolve the owning tenant for a store id (cached). */
async function tenantIdForStore(storeId: number): Promise<number> {
  const cached = storeTenantCache.get(storeId);
  if (cached && Date.now() - cached.at < STORE_TENANT_CACHE_TTL_MS) return cached.tenantId;
  const { data } = await supabase
    .from("stores")
    .select("tenant_id")
    .eq("id", storeId)
    .maybeSingle();
  const tenantId = data && data.tenant_id ? Number(data.tenant_id) : storeId;
  storeTenantCache.set(storeId, { tenantId, at: Date.now() });
  return tenantId;
}

async function writeStockLedger(input: {
  tenantId: number;
  warehouseId: number | null;
  productId: number;
  movementType: string;
  quantity: number;
  referenceType: string;
  referenceId: number | null;
  idempotencyKey: string;
}): Promise<void> {
  const { error } = await supabase.from("stock_ledger").insert({
    tenant_id: input.tenantId,
    warehouse_id: input.warehouseId,
    product_id: input.productId,
    movement_type: input.movementType,
    quantity: input.quantity,
    reference_type: input.referenceType,
    reference_id: input.referenceId,
    idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
}

export function formatAuditError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Request failed.";
}

async function assertTenantWritable(storeId: number): Promise<void> {
  const { data, error } = await supabase
    .from("tenants")
    .select("status, subscription_expires_at")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  if (data.status !== "active") throw new Error("This tenant is suspended and currently read-only.");
  if (data.subscription_expires_at && new Date(data.subscription_expires_at).getTime() <= Date.now()) {
    throw new Error("This tenant trial or subscription has expired and is currently read-only.");
  }
}

async function getMainWarehouse(storeId: number): Promise<WarehouseRow | null> {
  const { data } = await supabase
    .from("warehouses")
    .select("id, store_id, name, location, is_main")
    .eq("store_id", storeId)
    .eq("is_main", true)
    .maybeSingle();
  return (data as WarehouseRow) ?? null;
}

async function getWarehouseQty(
  warehouseId: number,
  productId: number
): Promise<number> {
  const { data } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();
  return data ? toNumber(data.quantity) : 0;
}

async function upsertInventoryQty(
  warehouseId: number,
  productId: number,
  quantity: number,
  tenantId?: number
): Promise<void> {
  const { error } = await supabase
    .from("inventory")
    .upsert(
      {
        warehouse_id: warehouseId,
        product_id: productId,
        quantity,
        ...(tenantId ? { tenant_id: tenantId } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "warehouse_id,product_id" }
    );
  if (error) throw error;
}

async function syncProductStock(storeId: number, productId: number): Promise<void> {
  const main = await getMainWarehouse(storeId);
  if (!main) return;
  const qty = await getWarehouseQty(main.id, productId);
  const { error } = await supabase
    .from("products")
    .update({ stock: qty })
    .eq("id", productId)
    .eq("store_id", storeId);
  if (error) throw error;
}

export async function logAudit(
  storeId: number,
  userId: string | null,
  entry: AuditEntry,
  options: { ip?: string | null } = {}
): Promise<void> {
  const tenantId = await tenantIdForStore(storeId);
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    store_id: storeId,
    user_id: userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    metadata: entry.metadata ?? null,
    ip_address: options.ip ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Sales (idempotent per client_op_id, warehouse-aware, audited)
// ---------------------------------------------------------------------------
export async function serverRecordSale(
  storeId: number,
  input: {
    warehouseId?: number | null;
    clientOpId?: string | null;
    items: Array<{ product_id: number; quantity: number }>;
    userId?: string | null;
    ip?: string | null;
  }
): Promise<{ duplicate: boolean }> {
  await assertTenantWritable(storeId);
  const { items } = input;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items were provided.");
  }

  if (input.clientOpId) {
    const { data: existing } = await supabase
      .from("sales")
      .select("id")
      .eq("store_id", storeId)
      .eq("client_op_id", input.clientOpId)
      .maybeSingle();
    if (existing) return { duplicate: true };
  }

  const productIds = items.map((i) => i.product_id);
  const { data: productRows, error: fetchError } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .in("id", productIds)
    .eq("store_id", storeId);
  if (fetchError) throw fetchError;

  const productMap = new Map<
    number,
    { id: number; name: string; price: number; stock: number }
  >((productRows ?? []).map((p: any) => [Number(p.id), p as never]));

  const warehouseId = input.warehouseId ?? null;
  let main: WarehouseRow | null = null;
  if (warehouseId) main = await getMainWarehouse(storeId);

  for (const item of items) {
    const product = productMap.get(item.product_id);
    if (!product) throw new Error(`Unknown product id ${item.product_id}`);

    const available = warehouseId
      ? await getWarehouseQty(warehouseId, item.product_id)
      : toNumber(product.stock);
    if (available < item.quantity) {
      throw new Error(`Not enough stock for "${product.name}".`);
    }
  }

  let saleId: number | null = null;
  for (const item of items) {
    const product = productMap.get(item.product_id)!;
    const unitPrice = toNumber(product.price);
    const stockBefore = warehouseId
      ? await getWarehouseQty(warehouseId, item.product_id)
      : toNumber(product.stock);
    const stockAfter = stockBefore - item.quantity;

    if (warehouseId) {
      await upsertInventoryQty(warehouseId, item.product_id, stockAfter, await tenantIdForStore(storeId));
    } else {
      const { error } = await supabase
        .from("products")
        .update({ stock: stockAfter })
        .eq("id", item.product_id)
        .eq("store_id", storeId);
      if (error) throw error;
    }
    if (main && warehouseId && main.id === warehouseId) {
      await syncProductStock(storeId, item.product_id);
    }

    const saleInsert = await supabase
      .from("sales")
      .insert({
        store_id: storeId,
        product_id: item.product_id,
        sold_at: new Date().toISOString(),
        quantity: item.quantity,
        unit_price: unitPrice,
        unit_cost: Math.round(unitPrice * COST_RATIO * 100) / 100,
        client_op_id: saleId === null ? input.clientOpId ?? null : null,
      })
      .select("id")
      .single();
    if (saleInsert.error) throw saleInsert.error;
    const inserted = saleInsert.data as { id: number } | null;
    saleId = inserted ? Number(inserted.id) : null;

    await logAudit(storeId, input.userId ?? null, {
      action: "sale_created",
      entityType: "sale",
      entityId: saleId,
      newValue: {
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        unit_cost: Math.round(unitPrice * COST_RATIO * 100) / 100,
      },
      metadata: {
        warehouse_id: warehouseId,
        client_op_id: input.clientOpId ?? null,
        stock_before: stockBefore,
        stock_after: stockAfter,
      },
    }, { ip: input.ip ?? null });

    const movementWarehouseId = warehouseId ?? main?.id ?? null;
    await writeStockLedger({
      tenantId: await tenantIdForStore(storeId),
      warehouseId: movementWarehouseId,
      productId: item.product_id,
      movementType: "sale",
      quantity: -item.quantity,
      referenceType: "sale",
      referenceId: saleId,
      idempotencyKey: `sale-${saleId ?? "n/a"}-${item.product_id}`,
    });
  }

  return { duplicate: false };
}

// ---------------------------------------------------------------------------
// Stock transfers
// ---------------------------------------------------------------------------
export async function serverTransfer(
  storeId: number,
  input: {
    productId: number;
    fromWarehouseId: number;
    toWarehouseId: number;
    quantity: number;
    note?: string | null;
    userId?: string | null;
    ip?: string | null;
  }
): Promise<{ ok: true }> {
  await assertTenantWritable(storeId);
  const { productId, fromWarehouseId, toWarehouseId, quantity } = input;
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("Source and destination warehouses must be different.");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("store_id", storeId);
  const ids = new Set((warehouses ?? []).map((w: any) => Number(w.id)));
  if (!ids.has(fromWarehouseId) || !ids.has(toWarehouseId)) {
    throw new Error("One or both warehouses do not belong to this store.");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!product) throw new Error("Unknown product.");

  const sourceBefore = await getWarehouseQty(fromWarehouseId, productId);
  if (sourceBefore < quantity) {
    throw new Error(
      `Not enough stock for "${product.name}" in the source warehouse.`
    );
  }

  const destBefore = await getWarehouseQty(toWarehouseId, productId);
  const transferTenantId = await tenantIdForStore(storeId);
  await upsertInventoryQty(fromWarehouseId, productId, sourceBefore - quantity, transferTenantId);
  await upsertInventoryQty(toWarehouseId, productId, destBefore + quantity, transferTenantId);

  const main = await getMainWarehouse(storeId);
  if (main && (main.id === fromWarehouseId || main.id === toWarehouseId)) {
    await syncProductStock(storeId, productId);
  }

const { error: transferInsertError, data: transferInserted } = await supabase
    .from("stock_transfers")
    .insert({
      store_id: storeId,
      tenant_id: await tenantIdForStore(storeId),
      product_id: productId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      quantity,
      status: "completed",
      note: input.note ?? null,
      created_by_user_id: input.userId ?? null,
    })
    .select("id")
    .single();
  if (transferInsertError) throw transferInsertError;
  const transferId =
    transferInserted && "id" in transferInserted ? Number(transferInserted.id) : null;

  const tenantId = await tenantIdForStore(storeId);
  await writeStockLedger({
    tenantId,
    warehouseId: fromWarehouseId,
    productId,
    movementType: "transfer_out",
    quantity: -quantity,
    referenceType: "stock_transfer",
    referenceId: transferId,
    idempotencyKey: `transfer-${transferId ?? "n/a"}-out`,
  });
  await writeStockLedger({
    tenantId,
    warehouseId: toWarehouseId,
    productId,
    movementType: "transfer_in",
    quantity,
    referenceType: "stock_transfer",
    referenceId: transferId,
    idempotencyKey: `transfer-${transferId ?? "n/a"}-in`,
  });

  await logAudit(storeId, input.userId ?? null, {
      action: "transfer_completed",
      entityType: "stock_transfer",
      entityId: transferId,
      oldValue: {
        from: { warehouse_id: fromWarehouseId, quantity: sourceBefore },
        to: { warehouse_id: toWarehouseId, quantity: destBefore },
      },
      newValue: {
        from: { warehouse_id: fromWarehouseId, quantity: sourceBefore - quantity },
        to: { warehouse_id: toWarehouseId, quantity: destBefore + quantity },
      },
      metadata: { product_id: productId, product_name: product.name, note: input.note ?? null },
    }, { ip: input.ip ?? null });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Product lifecycle (audited)
// ---------------------------------------------------------------------------
export async function serverCreateProduct(
  storeId: number,
  input: { name: string; price: number; stock: number; userId?: string | null; ip?: string | null }
): Promise<{ id: number }> {
  await assertTenantWritable(storeId);
  const { data: created, error } = await supabase
    .from("products")
    .insert({ store_id: storeId, name: input.name, price: input.price, stock: input.stock })
    .select("id")
    .single();
  if (error) throw error;

  const productId = Number(created.id);
  const tenantId = await tenantIdForStore(storeId);
  await supabase
    .from("products")
    .update({ tenant_id: tenantId })
    .eq("id", productId);

  const main = await getMainWarehouse(storeId);
  if (main) {
    await upsertInventoryQty(main.id, productId, input.stock, tenantId);
  }

  await logAudit(storeId, input.userId ?? null, {
    action: "product_created",
    entityType: "product",
    entityId: productId,
    newValue: { name: input.name, price: input.price, stock: input.stock },
    metadata: { warehouse_id: main?.id ?? null },
  }, { ip: input.ip ?? null });

  return { id: productId };
}

export async function serverUpdateProduct(
  storeId: number,
  input: {
    id: number;
    name?: string;
    price?: number;
    stock?: number;
    userId?: string | null;
    ip?: string | null;
  }
): Promise<{ ok: true }> {
  await assertTenantWritable(storeId);
  const { data: product } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .eq("id", input.id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!product) throw new Error("Unknown product.");

  const next: { name?: string; price?: number; stock?: number } = {};
  const priceEdited =
    typeof input.price === "number" && input.price !== toNumber(product.price);
  const stockEdited =
    typeof input.stock === "number" && input.stock !== toNumber(product.stock);

  if (input.name !== undefined && input.name !== String(product.name)) {
    if (!input.name.trim()) throw new Error("Product name cannot be empty.");
    next.name = input.name.trim();
  }
  if (priceEdited) next.price = input.price;
  if (stockEdited) next.stock = input.stock;

  if (Object.keys(next).length === 0) return { ok: true };

  const { error } = await supabase
    .from("products")
    .update(next)
    .eq("id", input.id)
    .eq("store_id", storeId);
  if (error) throw error;

  if (stockEdited) {
    const main = await getMainWarehouse(storeId);
    if (main) {
      await upsertInventoryQty(main.id, input.id, input.stock as number, await tenantIdForStore(storeId));
      await syncProductStock(storeId, input.id);
    }
    await logAudit(storeId, input.userId ?? null, {
      action: "stock_change",
      entityType: "product",
      entityId: input.id,
      oldValue: { stock: toNumber(product.stock) },
      newValue: { stock: input.stock },
      metadata: { warehouse_id: main?.id ?? null },
    }, { ip: input.ip ?? null });
    await writeStockLedger({
      tenantId: await tenantIdForStore(storeId),
      warehouseId: main?.id ?? null,
      productId: input.id,
      movementType: "adjustment",
      quantity: (input.stock as number) - toNumber(product.stock),
      referenceType: "product",
      referenceId: input.id,
      idempotencyKey: `adjust-${input.id}-${Date.now()}`,
    });
  }

  if (priceEdited) {
    await logAudit(storeId, input.userId ?? null, {
      action: "price_edit",
      entityType: "product",
      entityId: input.id,
      oldValue: { price: toNumber(product.price) },
      newValue: { price: input.price },
    });
  }

  if (!priceEdited && !stockEdited && next.name) {
    await logAudit(storeId, input.userId ?? null, {
      action: "product_renamed",
      entityType: "product",
      entityId: input.id,
      oldValue: { name: String(product.name) },
      newValue: { name: next.name },
    });
  }

  return { ok: true };
}

export async function serverDeleteProduct(
  storeId: number,
  input: { id: number; userId?: string | null; ip?: string | null }
): Promise<{ ok: true }> {
  await assertTenantWritable(storeId);
  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", input.id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!product) throw new Error("Unknown product.");

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", input.id)
    .eq("store_id", storeId);
  if (error) throw error;

  await logAudit(storeId, input.userId ?? null, {
    action: "product_deleted",
    entityType: "product",
    entityId: input.id,
    oldValue: { name: String(product.name) },
  }, { ip: input.ip ?? null });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stock transfer requests (approval workflow: StockTransferRequest)
// ---------------------------------------------------------------------------
export async function serverCreateTransferRequest(
  storeId: number,
  input: {
    productId: number;
    fromWarehouseId: number;
    toWarehouseId: number;
    quantity: number;
    note?: string | null;
    userId?: string | null;
    ip?: string | null;
  }
): Promise<{ id: number }> {
  await assertTenantWritable(storeId);
  const { productId, fromWarehouseId, toWarehouseId, quantity } = input;
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("Source and destination warehouses must be different.");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.");
  }

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("store_id", storeId);
  const ids = new Set((warehouses ?? []).map((w: any) => Number(w.id)));
  if (!ids.has(fromWarehouseId) || !ids.has(toWarehouseId)) {
    throw new Error("One or both warehouses do not belong to this store.");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!product) throw new Error("Unknown product.");

  const { data: inserted, error } = await supabase
    .from("stock_transfers")
    .insert({
      store_id: storeId,
      tenant_id: await tenantIdForStore(storeId),
      product_id: productId,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      quantity,
      status: "pending",
      note: input.note ?? null,
      created_by_user_id: input.userId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = inserted && "id" in inserted ? Number(inserted.id) : 0;

  await logAudit(storeId, input.userId ?? null, {
    action: "transfer_requested",
    entityType: "stock_transfer",
    entityId: id,
    newValue: {
      product_id: productId,
      product_name: product.name,
      from_warehouse_id: fromWarehouseId,
      to_warehouse_id: toWarehouseId,
      quantity,
    },
    metadata: { note: input.note ?? null, status: "pending" },
  }, { ip: input.ip ?? null });

  return { id };
}

export async function serverApproveTransferRequest(
  storeId: number,
  transferId: number,
  input: { userId?: string | null; ip?: string | null } = {}
): Promise<{ ok: true }> {
  await assertTenantWritable(storeId);
  const { data: request } = await supabase
    .from("stock_transfers")
    .select("id, product_id, from_warehouse_id, to_warehouse_id, quantity, note, status")
    .eq("id", transferId)
    .eq("store_id", storeId)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) throw new Error("Pending transfer request not found.");

  const productId = Number(request.product_id);
  const fromWarehouseId = Number(request.from_warehouse_id);
  const toWarehouseId = Number(request.to_warehouse_id);
  const quantity = Number(request.quantity);

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!product) throw new Error("Unknown product.");

  const sourceBefore = await getWarehouseQty(fromWarehouseId, productId);
  if (sourceBefore < quantity) {
    throw new Error(
      `Not enough stock for "${product.name}" in the source warehouse.`
    );
  }
  const destBefore = await getWarehouseQty(toWarehouseId, productId);
  const approveTenantId = await tenantIdForStore(storeId);
  await upsertInventoryQty(fromWarehouseId, productId, sourceBefore - quantity, approveTenantId);
  await upsertInventoryQty(toWarehouseId, productId, destBefore + quantity, approveTenantId);

  const main = await getMainWarehouse(storeId);
  if (main && (main.id === fromWarehouseId || main.id === toWarehouseId)) {
    await syncProductStock(storeId, productId);
  }

  const { error: updateError } = await supabase
    .from("stock_transfers")
    .update({ status: "completed" })
    .eq("id", transferId);
  if (updateError) throw updateError;

  const tenantId = await tenantIdForStore(storeId);
  await writeStockLedger({
    tenantId,
    warehouseId: fromWarehouseId,
    productId,
    movementType: "transfer_out",
    quantity: -quantity,
    referenceType: "stock_transfer",
    referenceId: transferId,
    idempotencyKey: `transfer-${transferId}-out`,
  });
  await writeStockLedger({
    tenantId,
    warehouseId: toWarehouseId,
    productId,
    movementType: "transfer_in",
    quantity,
    referenceType: "stock_transfer",
    referenceId: transferId,
    idempotencyKey: `transfer-${transferId}-in`,
  });

  await logAudit(storeId, input.userId ?? null, {
    action: "transfer_approved",
    entityType: "stock_transfer",
    entityId: transferId,
    oldValue: { status: "pending" },
    newValue: { status: "completed" },
    metadata: {
      product_id: productId,
      from: { warehouse_id: fromWarehouseId, quantity: sourceBefore },
      to: { warehouse_id: toWarehouseId, quantity: destBefore },
    },
  }, { ip: input.ip ?? null });

  return { ok: true };
}

export async function serverRejectTransferRequest(
  storeId: number,
  transferId: number,
  input: { userId?: string | null; ip?: string | null } = {}
): Promise<{ ok: true }> {
  const { data: request } = await supabase
    .from("stock_transfers")
    .select("id, status")
    .eq("id", transferId)
    .eq("store_id", storeId)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) throw new Error("Pending transfer request not found.");

  const { error } = await supabase
    .from("stock_transfers")
    .update({ status: "rejected" })
    .eq("id", transferId);
  if (error) throw error;

  await logAudit(storeId, input.userId ?? null, {
    action: "transfer_rejected",
    entityType: "stock_transfer",
    entityId: transferId,
    oldValue: { status: "pending" },
    newValue: { status: "rejected" },
  }, { ip: input.ip ?? null });

  return { ok: true };
}