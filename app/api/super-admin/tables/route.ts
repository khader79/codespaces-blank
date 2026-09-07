import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { audit, requireSuperAdmin, unauthorized } from "@/lib/super-admin";

export const runtime = "nodejs";
const tableNames = ["products", "invoices", "warehouses", "system_audit_logs"] as const;
const tableSchema = z.enum(tableNames);

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const table = tableSchema.safeParse(new URL(request.url).searchParams.get("table"));
    if (!table.success) return Response.json({ error: "Table is not available." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from(table.data).select("*").limit(100);
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
    const admin = getSupabaseAdmin();
    const values = body?.values ?? {};
    let result;
    if (action === "create") result = await admin.from(table.data).insert(values).select().single();
    else if (action === "update") result = await admin.from(table.data).update(values).eq("id", body?.id ?? "").select().single();
    else result = await admin.from(table.data).delete().eq("id", body?.id ?? "");
    if (result.error) return Response.json({ error: result.error.message }, { status: 503 });
    await audit(claims.user_id, `table.${action}`, table.data, body?.id == null ? null : String(body.id));
    return Response.json({ ok: true, row: "data" in result ? result.data : null });
  } catch (error) { return unauthorized(error); }
}