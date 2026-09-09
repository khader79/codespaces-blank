import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { STORE_ID } from "@/lib/tenant";

const CACHE_TTL_MS = 15_000;

export type TenantBilling = {
  subscription_plan: string;
  subscription_status: string;
  plan_status: string;
  status: string;
  subscription_expires_at: string | null;
  max_warehouses: number;
};

export type PlanInfo = {
  name: string;
  monthly_price: number;
  feature_flags: Record<string, boolean>;
};

const planCache = new Map<string, { value: PlanInfo; at: number }>();
const billingCache = new Map<number, { value: TenantBilling; at: number }>();

export function requireBilling(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Billing data unavailable.";
  return Response.json({ error: message }, { status: 503 });
}

export async function getTenantBilling(tenantId: number): Promise<TenantBilling> {
  const cached = billingCache.get(tenantId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const fallback: TenantBilling = {
    subscription_plan: "free",
    subscription_status: "none",
    plan_status: "trial",
    status: "active",
    subscription_expires_at: null,
    max_warehouses: 1,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("tenants")
    .select(
      "subscription_plan, subscription_status, plan_status, status, subscription_expires_at, max_warehouses"
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data) return fallback;

  const value: TenantBilling = {
    subscription_plan: String(data.subscription_plan ?? "free"),
    subscription_status: String(data.subscription_status ?? "none"),
    plan_status: String(data.plan_status ?? "trial"),
    status: String(data.status ?? "active"),
    subscription_expires_at: data.subscription_expires_at ?? null,
    max_warehouses: Number(data.max_warehouses ?? 1),
  };
  billingCache.set(tenantId, { value, at: Date.now() });
  return value;
}

export async function getPlan(planName: string): Promise<PlanInfo> {
  const key = planName || "free";
  const cached = planCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const empty: PlanInfo = { name: key, monthly_price: 0, feature_flags: {} };
  const { data, error } = await getSupabaseAdmin()
    .from("platform_plans")
    .select("name, monthly_price, feature_flags")
    .ilike("name", key)
    .maybeSingle();

  if (error || !data) return empty;
  const value: PlanInfo = {
    name: String(data.name),
    monthly_price: Number(data.monthly_price ?? 0),
    feature_flags: (data.feature_flags ?? {}) as Record<string, boolean>,
  };
  planCache.set(key, { value, at: Date.now() });
  return value;
}

const INACTIVE_BILLING = new Set(["canceled", "unpaid", "past_due", "suspended"]);

/**
 * Feature gate. Returns true when the tenant's active subscription includes
 * `featureName` on their current plan (platform_plans.feature_flags).
 */
export async function checkFeatureAccess(tenantId: number, featureName: string): Promise<boolean> {
  if (!Number.isInteger(tenantId) || tenantId <= 0) return false;

  const billing = await getTenantBilling(tenantId);
  if (billing.status !== "active") return false;
  if (INACTIVE_BILLING.has(billing.subscription_status)) return false;
  if (
    billing.subscription_expires_at &&
    new Date(billing.subscription_expires_at).getTime() <= Date.now()
  ) {
    return false;
  }

  const plan = await getPlan(billing.subscription_plan);
  return plan.feature_flags?.[featureName] === true;
}

/**
 * Route-handler guard: returns an HTTP response when the feature is locked,
 * or null when access is granted.
 */
export async function requireFeature(
  tenantId: number,
  featureName: string
): Promise<Response | null> {
  const granted = await checkFeatureAccess(tenantId, featureName);
  if (granted) return null;
  return Response.json(
    {
      error: `"${featureName}" is not included in this workspace's current subscription. Upgrade to unlock it.`,
      code: "FEATURE_LOCKED",
      feature: featureName,
    },
    { status: 402 }
  );
}

/** Resolve the active tenant for a server route, defaulting to the singleton. */
export function tenantIdFromRequest(request: Request): number {
  const raw = request.headers.get("x-storeflow-tenant-id");
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : STORE_ID;
}