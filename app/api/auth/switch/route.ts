import { z } from "zod";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { OPERATOR_COOKIE, PRIMARY_COOKIE, createSessionToken, compareCredential, verifySessionToken } from "@/lib/auth-server";

export const runtime = "nodejs";
const schema = z.object({ pin: z.string().regex(/^\d{4,8}$/), userId: z.string().uuid() });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid operator switch request." }, { status: 400 });
  try {
    const primary = cookies().get(PRIMARY_COOKIE)?.value;
    const session = primary ? await verifySessionToken(primary, "access") : null;
    if (!session) return Response.json({ error: "An active primary session is required." }, { status: 401 });
    const { data: operator } = await getSupabaseAdmin().from("tenant_users").select("user_id, tenant_id, warehouse_id, role, allowed_warehouses, pin_hash, is_active").eq("user_id", parsed.data.userId).eq("tenant_id", session.tenant_id).eq("is_active", true).maybeSingle();
    if (!operator || !operator.pin_hash || !(await compareCredential(parsed.data.pin, operator.pin_hash))) return Response.json({ error: "Invalid operator credentials." }, { status: 401 });
    const token = await createSessionToken({ user_id: operator.user_id, tenant_id: operator.tenant_id, warehouse_id: operator.warehouse_id, role: operator.role, allowed_warehouses: operator.allowed_warehouses || [], token_type: "operator" }, "30m");
    const response = Response.json({ ok: true, operator: { user_id: operator.user_id, tenant_id: operator.tenant_id, warehouse_id: operator.warehouse_id, role: operator.role } });
    response.headers.append("Set-Cookie", `${OPERATOR_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  } catch { return Response.json({ error: "Invalid or expired primary session." }, { status: 401 }); }
}