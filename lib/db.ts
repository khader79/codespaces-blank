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

interface Catalog {
  products: Product[];
  warehouses: Warehouse[];
  sales: Sale[];
  transfers: StockTransfer[];
  inventory: Array<{ warehouse_id: number; product_id: number; quantity: number }>;
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

let catalogPromise: Promise<Catalog> | null = null;

async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch("/api/catalog", { cache: "no-store" });
  if (!res.ok) throw await readError(res);
  const body = (await res.json()) as Catalog;
  return {
    products: body.products ?? [],
    warehouses: body.warehouses ?? [],
    sales: body.sales ?? [],
    transfers: body.transfers ?? [],
    inventory: body.inventory ?? [],
  };
}

function getCatalog(): Promise<Catalog> {
  if (!catalogPromise) {
    catalogPromise = fetchCatalog().finally(() => {
      catalogPromise = null;
    });
  }
  return catalogPromise;
}

export async function getProducts(storeId = STORE_ID): Promise<Product[]> {
  const catalog = await getCatalog();
  const rows = catalog.products.filter((p) => Number(p.store_id ?? storeId) === storeId);
  return rows.map((product) => ({ ...product, warehouse_id: null }));
}

export async function getWarehouses(storeId = STORE_ID): Promise<Warehouse[]> {
  const catalog = await getCatalog();
  return catalog.warehouses
    .filter((w) => Number(w.store_id) === storeId)
    .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0));
}

export async function getWarehouseInventory(
  warehouseId: number
): Promise<Map<number, number>> {
  const catalog = await getCatalog();
  return new Map(
    catalog.inventory
      .filter((row) => Number(row.warehouse_id) === warehouseId)
      .map((row) => [Number(row.product_id), Number(row.quantity)])
  );
}

export async function getRecentTransfers(
  storeId = STORE_ID,
  limit = 10
): Promise<StockTransfer[]> {
  const catalog = await getCatalog();
  return catalog.transfers
    .filter((t) => Number(t.store_id) === storeId)
    .slice(0, limit);
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
  const catalog = await getCatalog();
  return catalog.sales.filter((s) => Number(s.store_id) === storeId);
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