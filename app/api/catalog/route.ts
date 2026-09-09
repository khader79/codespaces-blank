import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ACCESS_COOKIE, verifySessionToken } from "@/lib/auth-server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated, service-role read path for the tenant dashboard.
 * RLS now locks every tenant table to auth.jwt() tenant_id, so the browser
 * can no longer anon-read them. This route serves the dashboard through a
 * verified session instead of the anon key.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return Response.json({ error: "Authorization required." }, { status: 401 });
  }
  let claims;
  try {
    claims = await verifySessionToken(token, "access");
  } catch {
    return Response.json({ error: "Authorization required." }, { status: 401 });
  }

  const tenantId = claims.tenant_id || 1;
  const admin = getSupabaseAdmin();

  const [products, warehouses, sales, transfers, inventory] = await Promise.all([
    admin
      .from("products")
      .select("id, name, price, stock, store_id, tenant_id, created_at")
      .eq("tenant_id", tenantId)
      .order("id", { ascending: true })
      .limit(500),
    admin
      .from("warehouses")
      .select("id, store_id, tenant_id, name, location, is_main")
      .eq("tenant_id", tenantId)
      .order("is_main", { ascending: false })
      .order("id", { ascending: true })
      .limit(100),
    admin
      .from("sales")
      .select("id, store_id, product_id, sold_at, quantity, unit_price, unit_cost")
      .eq("tenant_id", tenantId)
      .order("sold_at", { ascending: true })
      .limit(2000),
    admin
      .from("stock_transfers")
      .select(
        "*, product:products(name), from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(name), to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(name)"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("inventory")
      .select("warehouse_id, tenant_id, product_id, quantity")
      .eq("tenant_id", tenantId)
      .limit(2000),
  ]);

  const firstError =
    products.error ?? warehouses.error ?? sales.error ?? transfers.error ?? inventory.error;
  if (firstError) {
    return Response.json({ error: firstError.message }, { status: 503 });
  }

  return Response.json({
    products: products.data ?? [],
    warehouses: warehouses.data ?? [],
    sales: sales.data ?? [],
    transfers: transfers.data ?? [],
    inventory: inventory.data ?? [],
  });
}