import { STORE_ID } from "@/lib/tenant";

export const runtime = "nodejs";

interface CheckoutResponse {
  errors?: Array<{ detail?: string }>;
  data?: { attributes?: { url?: string } };
}

function originOf(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${forwarded}://${host}`;
}

async function createStripeCheckout(req: Request, tenantId: number): Promise<Response> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_PRO;
  if (!secretKey || !priceId) {
    return Response.json(
      {
        url: null,
        error: "Stripe checkout is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO.",
      },
      { status: 400 }
    );
  }

  const origin = originOf(req);
  const successUrl = process.env.STRIPE_SUCCESS_URL ?? `${origin}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL ?? `${origin}/settings?billing=cancelled`;

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(tenantId),
    "subscription_data[metadata][tenant_id]": String(tenantId),
    "metadata[tenant_id]": String(tenantId),
    "metadata[plan]": "pro",
  });

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(secretKey).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) {
      return Response.json(
        { error: json.error?.message ?? "Failed to create Stripe checkout session." },
        { status: res.status === 401 || res.status === 403 ? 503 : 502 }
      );
    }
    return Response.json({ url: json.url });
  } catch {
    return Response.json({ error: "Stripe checkout is unavailable right now." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.LS_API_KEY;
  const storeId = process.env.LS_STORE_ID;
  const variantId = process.env.LS_PRO_VARIANT_ID;

  let body: { store_id?: unknown; plan?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const tenantId =
    Number(body.store_id) > 0 ? Number(body.store_id) : STORE_ID;
  const tenantHeader = Number(req.headers.get("x-storeflow-tenant-id") ?? "");
  const effectiveTenantId =
    Number.isInteger(tenantHeader) && tenantHeader > 0 ? tenantHeader : tenantId;

  const stripeResponse = await createStripeCheckout(req, effectiveTenantId);
  if (stripeResponse.ok) return stripeResponse;

  // Legacy Lemon Squeezy fallback for existing deployments.
  if (!apiKey || !storeId || !variantId) {
    return Response.json(
      {
        error:
          "Billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO (or the legacy LS_API_KEY, LS_STORE_ID, LS_PRO_VARIANT_ID) to enable checkout.",
      },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: "",
            custom: { store_id: String(effectiveTenantId) },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as CheckoutResponse;

  if (!res.ok) {
    return Response.json(
      { error: json.errors?.[0]?.detail ?? "Failed to create checkout." },
      { status: 500 }
    );
  }

  const url = json.data?.attributes?.url;
  if (!url) {
    return Response.json(
      { error: "No checkout URL returned by Lemon Squeezy." },
      { status: 500 }
    );
  }

  return Response.json({ url });
}