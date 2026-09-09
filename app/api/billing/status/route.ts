import { getPlan, getTenantBilling } from "@/lib/plans";
import { tenantIdFromRequest } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const billing = await getTenantBilling(tenantId);
  const plan = await getPlan(billing.subscription_plan);

  const features: Record<string, boolean> = {};
  for (const key of Object.keys(plan.feature_flags ?? {})) {
    features[key] = plan.feature_flags[key] === true;
  }

  return Response.json({
    tenantId,
    subscription_plan: billing.subscription_plan,
    subscription_status: billing.subscription_status,
    plan_status: billing.plan_status,
    status: billing.status,
    subscription_expires_at: billing.subscription_expires_at,
    max_warehouses: billing.max_warehouses,
    features,
  });
}