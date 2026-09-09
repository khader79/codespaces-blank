import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { audit, requireSuperAdmin, unauthorized } from "@/lib/super-admin";
import { setMaintenance } from "@/lib/maintenance";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSuperAdmin();
    const { data } = await getSupabaseAdmin().from("platform_settings").select("maintenance_mode").eq("id", 1).maybeSingle();
    return Response.json({ maintenance: Boolean(data?.maintenance_mode), services: [{ name: "Database", status: "operational" }, { name: "Authentication", status: "operational" }, { name: "Cache", status: process.env.UPSTASH_REDIS_REST_URL ? "operational" : "not configured" }] });
  } catch (error) { return unauthorized(error); }
}

export async function PATCH(request: Request) {
  try {
    const claims = await requireSuperAdmin();
    const parsed = z.object({ action: z.enum(["maintenance", "flush-cache"]), enabled: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid infrastructure operation." }, { status: 400 });
    if (parsed.data.action === "flush-cache") {
      if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return Response.json({ error: "Redis cache is not configured." }, { status: 503 });
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/flushdb`, { method: "POST", headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` } });
      if (!response.ok) return Response.json({ error: "Redis cache flush failed." }, { status: 503 });
      await audit(claims.user_id, "platform.cache_flushed", "platform", "redis");
      return Response.json({ ok: true });
    }
    const enabled = parsed.data.enabled ?? false;
    const { error } = await getSupabaseAdmin().from("platform_settings").upsert({ id: 1, maintenance_mode: enabled, updated_by: claims.user_id }, { onConflict: "id" });
    if (error) return Response.json({ error: error.message }, { status: 503 });
    await setMaintenance(enabled);
    await audit(claims.user_id, enabled ? "platform.maintenance_enabled" : "platform.maintenance_disabled", "platform", "maintenance");
    return Response.json({ ok: true, maintenance: enabled });
  } catch (error) { return unauthorized(error); }
}