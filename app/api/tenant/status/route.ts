import { STORE_ID } from "@/lib/tenant";
import { getServerDataClient } from "@/lib/supabase-admin";

const supabase = getServerDataClient();

export const runtime = "nodejs";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("tenantId");
  const tenantId = Number(raw) > 0 ? Number(raw) : STORE_ID;
  const legacyStore = await supabase.from("products").select("store_id").eq("store_id", tenantId).limit(1).maybeSingle();
  if (!legacyStore.error) return Response.json({ active: Boolean(legacyStore.data), readOnly: false });

  const { data, error } = await supabase.from("tenants").select("id, status, subscription_expires_at").eq("id", tenantId).maybeSingle();
  if (error) {
    const fallback = await supabase.from("stores").select("id").eq("id", tenantId).maybeSingle();
    if (!fallback.error) return Response.json({ active: Boolean(fallback.data), readOnly: false });
    return Response.json({ active: true, readOnly: false });
  }
  if (!data) return Response.json({ active: true, readOnly: false });
  const expired = Boolean(data.subscription_expires_at && new Date(data.subscription_expires_at).getTime() <= Date.now());
  return Response.json({ active: data.status === "active", readOnly: data.status !== "active" || expired, expiresAt: data.subscription_expires_at });
}
