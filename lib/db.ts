import { supabase } from "@/lib/supabase";
import { STORE_ID } from "@/lib/tenant";

const INITIAL_PAGE_SIZE = 20;

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  store_id?: number;
  warehouse_id?: number | null;
  created_at?: string;
}

export interface Sale {
  id: number;
  store_id: number;
  product_id: number | null;
  sold_at: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface Warehouse {
  id: number;
  store_id: number;
  name: string;
  location: string | null;
  is_main: boolean;
}

export interface StockTransfer {
  id: number;
  store_id: number;
  product_id: number;
  from_warehouse_id: number | null;
  to_warehouse_id: number;
  quantity: number;
  status: string;
  note: string | null;
  created_at: string;
  product?: { name: string };
  from_warehouse?: { name: string };
  to_warehouse?: { name: string };
}

async function readError(res: Response): Promise<Error> {
  let message = `Request failed (${res.status}).`;
  try {
    const body = await res.json();
    if (body?.error) message = String(body.error);
  } catch {
    /* ignore */
  }
  return new Error(message);
}

export async function getProducts(storeId = STORE_ID): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock, store_id, created_at")
    .eq("store_id", storeId)
    .order("id", { ascending: true })
    .limit(INITIAL_PAGE_SIZE);

  if (error) throw error;
  return (data as Array<Omit<Product, "warehouse_id">> | null ?? []).map((product) => ({ ...product, warehouse_id: null }));
}

export async function getWarehouses(storeId = STORE_ID): Promise<Warehouse[]> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, store_id, name, is_main")
    .eq("store_id", storeId)
    .order("is_main", { ascending: false })
    .order("id", { ascending: true })
    .limit(INITIAL_PAGE_SIZE);

  if (error) throw error;
  return (data as Array<Omit<Warehouse, "location">> | null ?? []).map((warehouse) => ({ ...warehouse, location: null }));
}

export async function getWarehouseInventory(
  warehouseId: number
): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .eq("warehouse_id", warehouseId)
    .limit(INITIAL_PAGE_SIZE);

  if (error) throw error;
  return new Map(
    (data ?? []).map((row: { product_id: unknown; quantity: unknown }) => [
      Number(row.product_id),
      Number(row.quantity),
    ])
  );
}

export async function getRecentTransfers(
  storeId = STORE_ID,
  limit = 10
): Promise<StockTransfer[]> {
  const { data, error } = await supabase
    .from("stock_transfers")
    .select(
      "*, product:products(name), from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(name), to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(name)"
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function insertProduct(
  storeId: number,
  input: { name: string; price: number; stock: number }
): Promise<Product> {
  const res = await fetch("/api/product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, ...input }),
  });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as Product;
}

export async function deleteProduct(storeId: number, id: number): Promise<void> {
  const res = await fetch("/api/product", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, id }),
  });
  if (!res.ok) throw await readError(res);
}

export async function updateProductStock(
  storeId: number,
  id: number,
  stock: number
): Promise<void> {
  const res = await fetch("/api/product", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, id, stock }),
  });
  if (!res.ok) throw await readError(res);
}

export async function getSales(storeId = STORE_ID): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, store_id, product_id, sold_at, quantity, total_price")
    .eq("store_id", storeId)
    .order("sold_at", { ascending: true })
    .limit(INITIAL_PAGE_SIZE);

  if (error) throw error;
  return (data as Array<{ id: number; store_id: number; product_id: number | null; sold_at: string; quantity: number; total_price: number }> | null ?? []).map((sale) => ({
    ...sale,
    unit_price: Number(sale.quantity) ? Number(sale.total_price) / Number(sale.quantity) : 0,
    unit_cost: 0,
  }));
}

export async function recordSale(
  storeId: number,
  items: Array<{ product_id: number; quantity: number }>
): Promise<void> {
  const res = await fetch("/api/pos/sale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, items }),
  });
  if (!res.ok) throw await readError(res);
}