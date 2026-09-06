import { z } from "zod";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { allowLoginAttempt } from "@/lib/rate-limit";
import { ACCESS_COOKIE, PRIMARY_COOKIE, REFRESH_COOKIE, createSessionToken, normalizeIdentifier, secureCookie, compareCredential } from "@/lib/auth-server";
import { DEMO_ADMIN_EMAIL, isDemoAdmin } from "@/lib/demo-auth";

export const runtime = "nodejs";
const schema = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().max(128).optional(), pin: z.string().regex(/^\d{4,8}$/).optional() }).refine((value) => Boolean(value.password || value.pin));
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9O2n2f1Q7wC3vY2m2e2yM2kK1K7iK";

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid credentials." }, { status: 400 });
  const identifier = normalizeIdentifier(parsed.data.identifier);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await allowLoginAttempt(`${ip}:${identifier}`))) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  try {
    const demoAuthEnabled = process.env.NODE_ENV !== "production" || !process.env.STORE_FLOW_ADMIN_KEY;
    if (demoAuthEnabled && isDemoAdmin(identifier, parsed.data.password ?? "")) {
      const claims = { user_id: "demo-admin", tenant_id: 1, warehouse_id: null, assigned_warehouse_id: null, role: "SUPER_ADMIN", allowed_warehouses: [], token_type: "access" as const };
      const response = NextResponse.json({ user: { id: "demo-admin", email: DEMO_ADMIN_EMAIL, username: "admin", phone: null, tenant_id: 1, warehouse_id: null, assigned_warehouse_id: null, role: "SUPER_ADMIN", allowed_warehouses: [] } });
      const access = await createSessionToken(claims, "15m");
      response.cookies.set(ACCESS_COOKIE, access, { ...secureCookie, maxAge: 900 });
      response.cookies.set(PRIMARY_COOKIE, access, { ...secureCookie, maxAge: 900 });
      response.cookies.set(REFRESH_COOKIE, await createSessionToken({ ...claims, token_type: "refresh" }, "7d"), { ...secureCookie, maxAge: 604800 });
      return response;
    }
    const admin = getSupabaseAdmin();
    const { data: user } = await admin.from("tenant_users").select("user_id, tenant_id, warehouse_id, role, allowed_warehouses, password_hash, pin_hash, email, username, phone").eq("identifier_normalized", identifier).eq("is_active", true).maybeSingle();
    const hash = user ? (parsed.data.pin ? user.pin_hash : user.password_hash) : null;
    const valid = await compareCredential(parsed.data.password || parsed.data.pin || "", hash || DUMMY_HASH);
    if (!user || !hash || !valid) return Response.json({ error: "Invalid credentials." }, { status: 401 });
    const { data: systemAdmin } = await admin.from("system_admins").select("user_id").eq("user_id", user.user_id).maybeSingle();
    const role = systemAdmin ? "SUPER_ADMIN" : user.role;
    const assignedWarehouseId = systemAdmin ? null : user.warehouse_id;
    const claims = { user_id: user.user_id, tenant_id: systemAdmin ? 0 : user.tenant_id, warehouse_id: assignedWarehouseId, assigned_warehouse_id: assignedWarehouseId, role, allowed_warehouses: systemAdmin ? [] : user.allowed_warehouses || [], token_type: "access" as const };
    const response = NextResponse.json({ user: { id: user.user_id, email: user.email, username: user.username, phone: user.phone, tenant_id: systemAdmin ? 0 : user.tenant_id, warehouse_id: assignedWarehouseId, assigned_warehouse_id: assignedWarehouseId, role, allowed_warehouses: systemAdmin ? [] : user.allowed_warehouses || [] } });
    const access = await createSessionToken(claims, "15m");
    response.cookies.set(ACCESS_COOKIE, access, { ...secureCookie, maxAge: 900 });
    response.cookies.set(PRIMARY_COOKIE, access, { ...secureCookie, maxAge: 900 });
    response.cookies.set(REFRESH_COOKIE, await createSessionToken({ ...claims, token_type: "refresh" }, "7d"), { ...secureCookie, maxAge: 604800 });
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Authentication is temporarily unavailable." }, { status: 503 });
  }
}