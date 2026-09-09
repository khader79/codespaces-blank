import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { audit, requireSuperAdmin, unauthorized } from "@/lib/super-admin";

export const runtime = "nodejs";

const tableNames = [
  "tenants", "tenant_users", "stores", "warehouses", "products", "invoices", "invoice_lines",
  "sales", "customers", "payments", "returns", "return_lines", "inventory", "inventory_stock",
  "stock_ledger", "stock_transfers", "journal_entries", "journal_lines", "chart_of_accounts",
  "audit_logs", "system_audit_logs", "platform_plans", "platform_settings", "tenant_promotions",
  "activation_vouchers", "entities", "inventory_lots", "product_bom_lines", "inventory_cost_layers",
  "financial_account_balances", "ai_recommendations",
] as const;

const tableSchema = z.enum(tableNames);

const tenantUsersSafeColumns = "id,user_id,tenant_id,warehouse_id,role,username,phone,email,identifier_normalized,allowed_warehouses,is_active,created_at";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const table = tableSchema.safeParse(new URL(request.url).searchParams.get("table"));
    if (!table.success) return Response.json({ error: "Table is not available." }, { status: 400 });
    const limit = Math.min(Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 500), 2000);
    const admin = getSupabaseAdmin();
    const query = table.data === "tenant_users" ? admin.from(table.data).select(tenantUsersSafeColumns).order("id", { ascending: true }).limit(limit) : admin.from(table.data).select("*").order("id", { ascending: true }).limit(limit);
    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ table: table.data, rows: data ?? [] });
  } catch (error) { return unauthorized(error); }
}

export async function POST(request: Request) { return write(request, "create"); }
export async function PATCH(request: Request) { return write(request, "update"); }
export async function DELETE(request: Request) { return write(request, "delete"); }

async function write(request: Request, action: "create" | "update" | "delete") {
  try {
    const claims = await requireSuperAdmin();
    const body = await request.json().catch(() => null) as { table?: string; id?: string | number; values?: Record<string, unknown> } | null;
    const table = tableSchema.safeParse(body?.table);
    if (!table.success) return Response.json({ error: "Table is not available." }, { status: 400 });
    let values = { ...(body?.values ?? {}) };
    if (table.data === "tenant_users") {
      delete values.password_hash;
      delete values.pin_hash;
    }
    const admin = getSupabaseAdmin();
    let result;
    if (action === "create") result = await admin.from(table.data).insert(values).select().single();
    else if (action === "update") result = await admin.from(table.data).update(values).eq("id", body?.id ?? "").select().single();
    else result = await admin.from(table.data).delete().eq("id", body?.id ?? "");
    if (result.error) return Response.json({ error: result.error.message }, { status: 503 });
    await audit(claims.user_id, `table.${action}`, table.data, body?.id == null ? null : String(body.id));
    return Response.json({ ok: true, row: "data" in result ? result.data : null });
  } catch (error) { return unauthorized(error); }
}