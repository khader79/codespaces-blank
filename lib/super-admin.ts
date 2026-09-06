import { cookies } from "next/headers";
import { ACCESS_COOKIE, verifySessionToken, type SessionClaims } from "@/lib/auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function requireSuperAdmin(): Promise<SessionClaims> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) throw new Error("Super admin authorization required.");
  const claims = await verifySessionToken(token, "access");
  if (claims.role !== "SUPER_ADMIN") throw new Error("Super admin authorization required.");
  const localDemoAdmin = process.env.NODE_ENV !== "production" && claims.user_id === "demo-admin";
  const { data } = await getSupabaseAdmin().from("system_admins").select("user_id").eq("user_id", claims.user_id).maybeSingle();
  if (!data && !localDemoAdmin) throw new Error("Super admin authorization required.");
  return claims;
}

export function unauthorized(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Super admin authorization required." }, { status: 401 });
}

export async function audit(actorUserId: string, action: string, targetType: string, targetId: string | number | null, metadata: Record<string, unknown> = {}) {
  await getSupabaseAdmin().from("system_audit_logs").insert({ actor_user_id: actorUserId, action, target_type: targetType, target_id: targetId === null ? null : String(targetId), metadata });
}