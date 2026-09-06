import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DEMO_ADMIN_EMAIL, isDemoAdmin } from "@/lib/demo-auth";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const configured = process.env.STORE_FLOW_ADMIN_KEY;
  const key = request.headers.get("x-storeflow-admin-key") ?? "";
  return Boolean((configured && key === configured) || (!configured && isDemoAdmin(DEMO_ADMIN_EMAIL, key)));
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  if (!process.env.STORE_FLOW_ADMIN_KEY) return Response.json({ tenants: [{ id: 1, name: "Demo Store", status: "active", created_at: new Date().toISOString(), subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), user_count: 1 }] });
  try {
    const admin = getSupabaseAdmin();
    const { data: tenants, error } = await admin.from("tenants").select("id, name, status, created_at, subscription_expires_at").order("created_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const memberships = await admin.from("tenant_memberships").select("tenant_id, user_id");
    const countByTenant = new Map<number, number>();
    for (const membership of memberships.data ?? []) countByTenant.set(Number(membership.tenant_id), (countByTenant.get(Number(membership.tenant_id)) ?? 0) + 1);
    return Response.json({ tenants: (tenants ?? []).map((tenant) => ({ ...tenant, user_count: countByTenant.get(Number(tenant.id)) ?? 0 })), userCount: users.data.users.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin service unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = z.object({ tenantId: z.number().int().positive(), status: z.enum(["active", "suspended"]), months: z.number().int().min(0).max(120).default(0) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid tenant update." }, { status: 400 });
  if (!process.env.STORE_FLOW_ADMIN_KEY) return Response.json({ ok: true, demo: true });
  try {
    const admin = getSupabaseAdmin();
    const patch: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.months > 0) patch.subscription_expires_at = new Date(Date.now() + parsed.data.months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from("tenants").update(patch).eq("id", parsed.data.tenantId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tenant update failed." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Admin authorization required." }, { status: 401 });
  const parsed = z.object({ months: z.number().int().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Months must be between 1 and 120." }, { status: 400 });
  if (!process.env.STORE_FLOW_ADMIN_KEY) return Response.json({ code: `SF-DEMO-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`, months: parsed.data.months }, { status: 201 });
  try {
    const admin = getSupabaseAdmin();
    const code = `SF-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { error } = await admin.from("activation_vouchers").insert({ code, months: parsed.data.months });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ code, months: parsed.data.months }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Voucher generation failed." }, { status: 503 });
  }
}
