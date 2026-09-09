import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type StripeObject = Record<string, any>;

function deriveTenantId(object: StripeObject): number | null {
  const raw = object?.metadata?.tenant_id ?? object?.client_reference_id;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function planFromPrice(priceId: unknown): string | null {
  if (typeof priceId !== "string" || !priceId) return null;
  const byEnv: Record<string, string | undefined> = {
    free: process.env.STRIPE_PRICE_FREE,
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  for (const [plan, id] of Object.entries(byEnv)) {
    if (id && priceId === id) return plan;
  }
  return null;
}

const STRIPE_STATUS_MAP: Record<string, string> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "unpaid",
  canceled: "canceled",
  paused: "paused",
  incomplete: "past_due",
  incomplete_expired: "canceled",
};

function syncHelper(): StripeSyncHelper {
  return new StripeSyncHelper();
}

class StripeSyncHelper {
  async updateTenant(
    tenantId: number,
    patch: Record<string, unknown>
  ): Promise<boolean> {
    const { error } = await getSupabaseAdmin()
      .from("tenants")
      .update(patch)
      .eq("id", tenantId);
    return !error;
  }

  async tenantIdFromCustomer(customerId: string | null): Promise<number | null> {
    if (!customerId) return null;
    const { data } = await getSupabaseAdmin()
      .from("tenants")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data ? Number(data.id) : null;
  }

  async markProcessed(eventId: string, type: string, tenantId: number | null, payload: unknown): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from("billing_events").upsert(
      { id: eventId, type, tenant_id: tenantId, payload: payload as any },
      { onConflict: "id" }
    );
    return !error;
  }
}

function verifyStripeSignature(payload: string, sigHeader: string | null): {
  ok: boolean;
  timestamp?: string;
} {
  if (!sigHeader) return { ok: false };
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false };

  const parts: Record<string, string> = {};
  for (const pair of sigHeader.split(",")) {
    const idx = pair.indexOf("=");
    if (idx > 0) parts[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
  const timestamp = parts["t"];
  const provided = parts["v1"];
  if (!timestamp || !provided) return { ok: false };

  const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (skewSeconds > 300) return { ok: false };

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  return { ok, timestamp };
}

function planOf(subscription: StripeObject): string | null {
  const metadataPlan =
    typeof subscription?.metadata?.plan === "string"
      ? subscription.metadata.plan
      : null;
  if (metadataPlan) return metadataPlan;
  const items = Array.isArray(subscription?.items?.data)
    ? subscription.items.data
    : [];
  for (const item of items) {
    const plan = planFromPrice(item?.price?.id);
    if (plan) return plan;
  }
  return null;
}

function periodEnd(subscription: StripeObject): string | null {
  const secs = Number(subscription?.current_period_end);
  if (Number.isFinite(secs) && secs > 0) {
    return new Date(secs * 1000).toISOString();
  }
  return null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  const verified = verifyStripeSignature(raw, sig);
  if (!verified.ok) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: StripeObject } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const eventId = event.id;
  const type = event.type ?? "";
  const object: StripeObject = event.data?.object ?? {};
  if (!eventId) return Response.json({ error: "Missing event id." }, { status: 400 });

  const helper = syncHelper();

  // Idempotency: Stripe retries failed deliveries; never process the same event twice.
  const { data: existing } = await getSupabaseAdmin()
    .from("billing_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (existing) return Response.json({ received: true, idempotent: true });

  let tenantId = deriveTenantId(object);
  let patch: Record<string, unknown> | null = null;
  let logAction = "billing.webhook";

  switch (type) {
    case "checkout.session.completed": {
      if (tenantId) {
        patch = {
          stripe_customer_id: object.customer ?? null,
          stripe_subscription_id: object.subscription ?? null,
          subscription_status: object.trial_end ? "trialing" : "active",
          plan_status: "active",
          status: "active",
        };
      }
      logAction = "billing.checkout_completed";
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      if (!tenantId) tenantId = await helper.tenantIdFromCustomer(object.customer ?? null);
      if (tenantId) {
        patch = {
          stripe_customer_id: object.customer ?? null,
          stripe_subscription_id: object.id ?? null,
          subscription_status: STRIPE_STATUS_MAP[String(object.status)] ?? "active",
          plan_status: "active",
        };
        const plan = planOf(object);
        if (plan) patch.subscription_plan = plan;
        const until = periodEnd(object);
        if (until) patch.subscription_expires_at = until;
        if (String(object.status) === "canceled") patch.status = "active";
        if (String(object.status) === "past_due") patch.subscription_status = "past_due";
      }
      logAction = `billing.subscription_${String(object.status) ?? "updated"}`;
      break;
    }
    case "customer.subscription.deleted": {
      if (!tenantId) tenantId = await helper.tenantIdFromCustomer(object.customer ?? null);
      if (tenantId) {
        patch = {
          subscription_status: "canceled",
          subscription_plan: "free",
        };
        const until = periodEnd(object);
        if (until) patch.subscription_expires_at = until;
      }
      logAction = "billing.subscription_canceled";
      break;
    }
    case "invoice.payment_failed": {
      const subscriptionId = String(object.subscription ?? "");
      if (subscriptionId) {
        const { data: sub } = await getSupabaseAdmin()
          .from("tenants")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();
        if (sub) tenantId = Number(sub.id);
      }
      if (!tenantId) tenantId = await helper.tenantIdFromCustomer(object.customer ?? null);
      if (tenantId) {
        patch = { subscription_status: "past_due" };
      }
      logAction = "billing.payment_failed";
      break;
    }
    case "invoice.payment_succeeded": {
      if (!tenantId) tenantId = await helper.tenantIdFromCustomer(object.customer ?? null);
      if (tenantId) {
        patch = { subscription_status: "active" };
      }
      logAction = "billing.payment_succeeded";
      break;
    }
    default:
      logAction = "billing.ignored";
      break;
  }

  if (tenantId && patch) {
    await helper.updateTenant(tenantId, patch);
  }
  await helper.markProcessed(eventId, type, tenantId, { type, action: logAction });

  return Response.json({ received: true, tenant: tenantId });
}