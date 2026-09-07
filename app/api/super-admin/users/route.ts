import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { audit, requireSuperAdmin, unauthorized } from "@/lib/super-admin";
import { hashCredential } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const admin = getSupabaseAdmin();
    let query = admin.from("tenant_users").select("user_id, tenant_id, email, username, role, is_active, created_at").order("created_at", { ascending: false }).limit(500);
    if (search) query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ users: data ?? [] });
  } catch (error) { return unauthorized(error); }
}

const schema = z.object({
  action: z.enum(["role", "ban", "unban", "assign-tenant", "reset-password"]),
  userId: z.string().uuid(),
  role: z.enum(["owner", "manager", "warehouse_worker", "cashier"]).optional(),
  tenantId: z.number().int().positive().optional(),
}).superRefine((value, context) => {
  if (value.action === "role" && !value.role) context.addIssue({ code: "custom", message: "Role is required." });
  if (value.action === "assign-tenant" && !value.tenantId) context.addIssue({ code: "custom", message: "Tenant is required." });
});

export async function PATCH(request: Request) {
  try {
    const claims = await requireSuperAdmin();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid user operation." }, { status: 400 });
    const admin = getSupabaseAdmin();
    if (parsed.data.action === "reset-password") {
      const temporaryPassword = `SF-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`;
      const { error } = await admin.from("tenant_users").update({ password_hash: await hashCredential(temporaryPassword), pin_hash: null }).eq("user_id", parsed.data.userId);
      if (error) return Response.json({ error: error.message }, { status: 503 });
      await admin.auth.admin.updateUserById(parsed.data.userId, { password: temporaryPassword });
      await audit(claims.user_id, "user.password_reset", "user", parsed.data.userId);
      return Response.json({ ok: true, temporaryPassword });
    }
    const patch = parsed.data.action === "role" ? { role: parsed.data.role } : parsed.data.action === "assign-tenant" ? { tenant_id: parsed.data.tenantId } : { is_active: parsed.data.action === "unban" };
    const { error } = await admin.from("tenant_users").update(patch).eq("user_id", parsed.data.userId);
    if (error) return Response.json({ error: error.message }, { status: 503 });
    await audit(claims.user_id, `user.${parsed.data.action}`, "user", parsed.data.userId, patch);
    return Response.json({ ok: true });
  } catch (error) { return unauthorized(error); }
}
