import Dexie, { type Table } from "dexie";

export interface CachedProduct {
  id: number;
  storeId: number;
  warehouseId: number | null;
  name: string;
  price: number;
  stock: number;
  cachedAt: number;
}

export interface CachedWarehouse {
  id: number;
  storeId: number;
  name: string;
  location: string | null;
  is_main: boolean;
}

export interface PendingOp {
  id?: number;
  kind: "sale" | "transfer" | "invoice_draft";
  storeId: number;
  clientOpId: string;
  status: "pending" | "failed";
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
  conflictStrategy?: "server-wins" | "client-wins";
  nextAttemptAt?: number;
}

class OfflineDB extends Dexie {
  products!: Table<CachedProduct, number>;
  productSnapshots!: Table<CachedProduct, [number, number | null, number]>;
  warehouses!: Table<CachedWarehouse, number>;
  pendingOps!: Table<PendingOp, number>;

  constructor() {
    super("storeflow-offline-v2");
    this.version(1).stores({
      products: "id, [storeId+warehouseId], name",
      productSnapshots: "[storeId+warehouseId+id], [storeId+warehouseId], id",
      warehouses: "[storeId+id], storeId",
      pendingOps: "++id, [storeId+status], storeId, status, createdAt, kind, clientOpId",
    });
  }
}

let _db: OfflineDB | null = null;

function getDb(): OfflineDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
  if (!_db) _db = new OfflineDB();
  return _db;
}

export function newClientOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function cacheWarehouses(
  warehouses: Array<{
    id: number;
    store_id: number;
    name: string;
    location: string | null;
    is_main: boolean;
  }>
): Promise<void> {
  const rows: CachedWarehouse[] = warehouses.map((w) => ({
    id: w.id,
    storeId: w.store_id,
    name: w.name,
    location: w.location,
    is_main: w.is_main,
  }));
  await getDb().warehouses.bulkPut(rows);
}

export async function getCachedWarehouses(
  storeId: number
): Promise<CachedWarehouse[]> {
  const rows = await getDb()
    .warehouses.where("storeId")
    .equals(storeId)
    .toArray();
  return rows.sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.id - b.id);
}

export async function cacheProducts(
  storeId: number,
  warehouseId: number | null,
  products: Array<{ id: number; name: string; price: number; stock: number }>
): Promise<void> {
  const rows: CachedProduct[] = products.map((p) => ({
    id: p.id,
    storeId,
    warehouseId,
    name: p.name,
    price: Number(p.price) || 0,
    stock: Number(p.stock) || 0,
    cachedAt: Date.now(),
  }));
  const db = getDb();
  try {
    await db.productSnapshots.bulkPut(rows);
  } catch {
    // Keep older browsers usable if the snapshot store is still upgrading.
    await db.products.bulkPut(rows);
  }
}

export async function getCachedProducts(
  storeId: number,
  warehouseId: number | null
): Promise<CachedProduct[]> {
  const db = getDb();
  let rows: CachedProduct[];
  try {
    rows = await (db.productSnapshots.where("[storeId+warehouseId]") as any)
      .equals([storeId, warehouseId])
      .toArray();
  } catch {
    rows = await (db.products.where("[storeId+warehouseId]") as any)
      .equals([storeId, warehouseId])
      .toArray();
  }
  return rows.sort((a, b) => a.id - b.id);
}

export async function patchCachedStockById(
  productId: number,
  warehouseId: number | null,
  delta: number
): Promise<void> {
  const db = getDb();
  let table: Table<CachedProduct, any> = db.productSnapshots;
  let rows: CachedProduct[];
  try {
    rows = await table.where("id").equals(productId).toArray();
  } catch {
    table = db.products;
    rows = await table.where("id").equals(productId).toArray();
  }
  if (rows.length === 0) return;
  await table.bulkPut(
    rows
      .filter((r) => r.warehouseId === warehouseId)
      .map((r) => ({
        ...r,
        stock: Math.max(0, r.stock - delta),
        cachedAt: Date.now(),
      }))
  );
}

export async function enqueueOp(
  kind: PendingOp["kind"],
  storeId: number,
  payload: Record<string, unknown>,
  clientOpId = newClientOpId(),
  conflictStrategy: PendingOp["conflictStrategy"] = "server-wins"
): Promise<PendingOp> {
  const op: PendingOp = {
    kind,
    storeId,
    clientOpId,
    status: "pending",
    payload: { ...payload, clientOpId, storeId },
    createdAt: Date.now(),
    attempts: 0,
    conflictStrategy,
    nextAttemptAt: Date.now(),
  };
  const id = await getDb().pendingOps.add(op);
  return { ...op, id };
}

export async function listPendingOps(storeId: number): Promise<PendingOp[]> {
  return getDb().pendingOps.where("storeId").equals(storeId).sortBy("createdAt");
}

export async function clearOp(id: number): Promise<void> {
  await getDb().pendingOps.delete(id);
}

export async function pendingCount(storeId: number): Promise<number> {
  return getDb().pendingOps.where("storeId").equals(storeId).count();
}

export interface SyncResult {
  synced: number;
  failed: number;
  rejected: Array<{ opId: number; kind: string; error: string }>;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Flushes queued operations to the server. Ops that are definitively rejected
 * by the API (4xx) are removed from the queue so they cannot resync forever;
 * network failures keep the op queued for the next attempt.
 */
export async function syncPendingOps(storeId: number): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, rejected: [] };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return result;
  }

  const ops = await listPendingOps(storeId);
  for (const op of ops) {
    if (op.nextAttemptAt && op.nextAttemptAt > Date.now()) continue;
    let res: Response;
    try {
      if (op.kind === "sale") {
        res = await postJson("/api/pos/sale", op.payload);
      } else if (op.kind === "transfer") {
        res = await postJson("/api/transfer", op.payload);
      } else if (op.kind === "invoice_draft") {
        res = await postJson("/api/finance/invoices/draft", op.payload);
      } else {
        continue;
      }
    } catch (error) {
      const attempts = (op.attempts ?? 0) + 1;
      const delay = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
      await getDb().pendingOps.update(op.id!, {
        attempts,
        status: "failed",
        lastError: error instanceof Error ? error.message : "Network error",
        nextAttemptAt: Date.now() + delay,
      });
      result.failed += 1;
      break;
    }

    if (res.ok) {
      await clearOp(op.id!);
      result.synced += 1;
      continue;
    }

    if (res.status >= 400 && res.status < 500) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) message = String(body.error);
      } catch {
        /* ignore */
      }
      await clearOp(op.id!);
      result.rejected.push({ opId: op.id!, kind: op.kind, error: message });
      continue;
    }

    const attempts = (op.attempts ?? 0) + 1;
    await getDb().pendingOps.update(op.id!, {
      attempts,
      status: "failed",
      lastError: `HTTP ${res.status}`,
      nextAttemptAt: Date.now() + Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6)),
    });
    result.failed += 1;
    break;
  }

  return result;
}