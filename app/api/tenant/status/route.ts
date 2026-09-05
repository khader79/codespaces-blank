import { STORE_ID } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("tenantId");
  const tenantId = Number(raw) > 0 ? Number(raw) : STORE_ID;
  const { data, error } = await supabase.from("tenants").select("id, status, subscription_expires_at").eq("id", tenantId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ active: true, readOnly: false });
  const expired = Boolean(data.subscription_expires_at && new Date(data.subscription_expires_at).getTime() <= Date.now());
  return Response.json({ active: data.status === "active", readOnly: data.status !== "active" || expired, expiresAt: data.subscription_expires_at });
}
