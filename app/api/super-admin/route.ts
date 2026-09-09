import { z } from "zod";
import { NextResponse } from "next/server";
import { hashCredential, OPERATOR_COOKIE, secureCookie, createSessionToken, normalizeIdentifier } from "@/lib/auth-server";
import { audit, requireSuperAdmin, unauthorized } from "@/lib/super-admin";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const emptyDashboard = {
  tenants: [],
  stats: {},
  plans: [],
  maintenance: false,
  metrics: { activeTenants: 0, totalCompanies: 0, totalUsers: 0, totalWarehouses: 0, totalProducts: 0, mrr: 0, transactionVolume: 0, suspendedTenants: 0, systemHealth: "degraded" },
  analytics: { monthlySignups: [], revenueTrend: [], salesVolume: [], planDistribution: [], roleDistribution: [], auditActivity: [] },
  topTenants: [],
  auditLogs: [],
  tenantAuditLogs: [],
};

function lastMonths(count: number) {
  const labels: string[] = [];
  const now = new Date();
  now.setUTCDate(1);
  for (let index = count - 1; index >= 0; index -= 1) {
    const cursor = new Date(now);
    cursor.setUTCMonth(now.getUTCMonth() - index);
    labels.push(cursor.toISOString().slice(0, 7));
  }
  return labels;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    try {
      const admin = getSupabaseAdmin();
      const [tenantResult, userResult, salesResult, invoiceResult, auditResult, tenantAuditResult, warehouseResult, productResult, warehouseByTenantResult, productByTenantResult, planResult, maintenanceResult] = await Promise.all([
        admin.from("tenants").select("id, name, slug, status, plan_status, subscription_plan, max_users, max_warehouses, created_at, subscription_expires_at").order("created_at", { ascending: false }),
        admin.from("tenant_users").select("tenant_id, email, role, created_at").eq("is_active", true),
        admin.from("sales").select("quantity, unit_price, sold_at"),
        admin.from("invoices").select("total, issued_at"),
        admin.from("system_audit_logs").select("id, actor_user_id, action, target_type, target_id, metadata, created_at").order("created_at", { ascending: false }).limit(100),
        admin.from("audit_logs").select("id, tenant_id, user_id, action, entity_type, entity_id, metadata, ip_address, created_at").order("created_at", { ascending: false }).limit(100),
        admin.from("warehouses").select("id", { count: "exact", head: true }),
        admin.from("products").select("id", { count: "exact", head: true }),
        admin.from("warehouses").select("tenant_id"),
        admin.from("products").select("tenant_id"),
        admin.from("platform_plans").select("id, name, monthly_price, feature_flags, updated_at").order("monthly_price"),
        admin.from("platform_settings").select("maintenance_mode").eq("id", 1).maybeSingle(),
      ]);
      if (tenantResult.error || userResult.error || salesResult.error || auditResult.error) return Response.json(emptyDashboard);

      const tenants = tenantResult.data ?? [];
      const users = userResult.data ?? [];
      const sales = salesResult.data ?? [];
      const invoices = invoiceResult.error ? [] : (invoiceResult.data ?? []);
      const plans = planResult.error ? [] : (planResult.data ?? []);
      const planPrice = new Map(plans.map((plan) => [plan?.id, Number(plan?.monthly_price ?? 0)]));

      const usersByTenant = new Map<number, { email: string | null; count: number }>();
      for (const user of users) {
        const tenantId = Number(user?.tenant_id);
        if (!Number.isFinite(tenantId)) continue;
        const current = usersByTenant.get(tenantId) ?? { email: null, count: 0 };
        current.email ||= user?.email ?? null;
        current.count += 1;
        usersByTenant.set(tenantId, current);
      }

      const monthStart = new Date();
      monthStart.setUTCDate(1);
      const monthlySales = sales.filter((sale) => {
        const soldAt = sale?.sold_at ? new Date(sale.sold_at).getTime() : NaN;
        return Number.isFinite(soldAt) && soldAt >= monthStart.getTime();
      });
      const activeTenants = tenants.filter((tenant) => tenant?.status === "active");
      const mrr = activeTenants.reduce((total, tenant) => total + (tenant?.plan_status === "active" ? (planPrice.get(tenant?.subscription_plan ?? "") ?? 99) : 0), 0);

      const months = lastMonths(12);
      const startOfRange = new Date(`${months[0]}-01T00:00:00.000Z`).getTime();
      const monthOf = (value: unknown) => {
        const time = value ? new Date(value as string).getTime() : NaN;
        if (!Number.isFinite(time) || time < startOfRange) return null;
        return new Date(time).toISOString().slice(0, 7);
      };

      const signupBuckets = new Map(months.map((month) => [month, 0]));
      for (const tenant of tenants) { const key = monthOf(tenant?.created_at); if (key) signupBuckets.set(key, (signupBuckets.get(key) ?? 0) + 1); }

      const salesBuckets = new Map(months.map((month) => [month, { count: 0, revenue: 0 }]));
      for (const sale of sales) {
        const key = monthOf(sale?.sold_at); if (!key) continue;
        const bucket = salesBuckets.get(key)!;
        bucket.count += Number(sale?.quantity ?? 0);
        bucket.revenue += Number(sale?.quantity ?? 0) * Number(sale?.unit_price ?? 0);
      }
      const invoiceBuckets = new Map(months.map((month) => [month, 0]));
      for (const invoice of invoices) {
        const key = monthOf(invoice?.issued_at); if (!key) continue;
        invoiceBuckets.set(key, (invoiceBuckets.get(key) ?? 0) + Number(invoice?.total ?? 0));
      }

      const planDistribution = new Map<string, number>();
      for (const tenant of tenants) { const plan = tenant?.subscription_plan ?? "free"; planDistribution.set(plan, (planDistribution.get(plan) ?? 0) + 1); }
      const roleDistribution = new Map<string, number>();
      for (const user of users) { const role = user?.role ?? "unknown"; roleDistribution.set(role, (roleDistribution.get(role) ?? 0) + 1); }
      const auditActivity = new Map(months.map((month) => [month, 0]));
      for (const log of auditResult.data ?? []) { const key = monthOf(log?.created_at); if (key) auditActivity.set(key, (auditActivity.get(key) ?? 0) + 1); }

      const warehouseCounts = new Map<number, number>();
      for (const warehouse of warehouseByTenantResult.data ?? []) { const id = Number(warehouse?.tenant_id); if (Number.isFinite(id)) warehouseCounts.set(id, (warehouseCounts.get(id) ?? 0) + 1); }
      const productCounts = new Map<number, number>();
      for (const product of productByTenantResult.data ?? []) { const id = Number(product?.tenant_id); if (Number.isFinite(id)) productCounts.set(id, (productCounts.get(id) ?? 0) + 1); }

      const topTenants = tenants
        .map((tenant) => {
          const id = Number(tenant?.id);
          const summary = usersByTenant.get(id);
          return { id, name: tenant?.name, slug: tenant?.slug, status: tenant?.status, user_count: summary?.count ?? 0, warehouse_count: warehouseCounts.get(id) ?? 0, product_count: productCounts.get(id) ?? 0 };
        })
        .sort((a, b) => b.user_count - a.user_count)
        .slice(0, 5);

      return Response.json({
        tenants: tenants.map((tenant) => {
          const tenantId = Number(tenant?.id);
          const summary = usersByTenant.get(tenantId);
          return { ...tenant, admin_email: summary?.email ?? null, user_count: summary?.count ?? 0, warehouse_count: warehouseCounts.get(tenantId) ?? 0, product_count: productCounts.get(tenantId) ?? 0 };
        }),
        plans,
        maintenance: maintenanceResult.error ? false : Boolean(maintenanceResult.data?.maintenance_mode),
        metrics: {
          activeTenants: activeTenants.length,
          totalCompanies: tenants.length,
          totalUsers: users.length,
          totalWarehouses: warehouseResult.count ?? 0,
          totalProducts: productResult.count ?? 0,
          mrr,
          transactionVolume: monthlySales.length,
          suspendedTenants: tenants.filter((tenant) => tenant?.status === "suspended").length,
          systemHealth: "healthy",
        },
        analytics: {
          monthlySignups: months.map((month) => ({ month, count: signupBuckets.get(month) ?? 0 })),
          revenueTrend: months.map((month) => ({ month, revenue: Math.round((invoiceBuckets.get(month) ?? 0) * 100) / 100 })),
          salesVolume: months.map((month) => ({ month, ...(salesBuckets.get(month) ?? { count: 0, revenue: 0 }) })),
          planDistribution: Array.from(planDistribution.entries()).map(([name, value]) => ({ name, value })),
          roleDistribution: Array.from(roleDistribution.entries()).map(([name, value]) => ({ name, value })),
          auditActivity: months.map((month) => ({ month, count: auditActivity.get(month) ?? 0 })),
        },
        topTenants,
        auditLogs: auditResult.data ?? [],
        tenantAuditLogs: tenantAuditResult.error ? [] : (tenantAuditResult.data ?? []),
      });
    } catch {
      return Response.json(emptyDashboard);
    }
  } catch (error) { return unauthorized(error); }
}

const updateSchema = z.union([
  z.object({ action: z.literal("status"), tenantId: z.number().int().positive(), status: z.enum(["active", "suspended"]), planStatus: z.enum(["trial", "active", "suspended"]).optional() }),
  z.object({ action: z.literal("delete"), tenantId: z.number().int().positive() }),
  z.object({ action: z.literal("plan"), tenantId: z.number().int().positive(), planStatus: z.enum(["trial", "active", "suspended"]).optional(), subscriptionPlan: z.enum(["free", "pro", "enterprise"]).optional() }).refine((value) => Boolean(value.planStatus || value.subscriptionPlan)),
  z.object({ action: z.literal("limits"), tenantId: z.number().int().positive(), maxUsers: z.number().int().positive().max(100000), maxWarehouses: z.number().int().positive().max(10000) }),
  z.object({ action: z.literal("reset-password"), tenantId: z.number().int().positive() }),
  z.object({ action: z.literal("impersonate"), tenantId: z.number().int().positive() }),
  z.object({ action: z.literal("maintenance"), enabled: z.boolean() }),
  z.object({ action: z.literal("plan-config"), planId: z.string().min(1), monthlyPrice: z.number().nonnegative().max(100000), featureFlags: z.record(z.boolean()) }),
  z.object({ action: z.literal("promo"), tenantId: z.number().int().positive(), extensionDays: z.number().int().positive().max(3650), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("provision"), companyName: z.string().trim().min(2).max(120), adminFullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), password: z.string().min(8).max(128), subscriptionPlan: z.enum(["free", "pro", "enterprise"]) }),
]);

export async function PATCH(request: Request) {
  try {
    const claims = await requireSuperAdmin();
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid platform operation." }, { status: 400 });
    const admin = getSupabaseAdmin();
    if (parsed.data.action === "delete") {
      const { error } = await admin.from("tenants").delete().eq("id", parsed.data.tenantId);
      if (error) return Response.json({ error: error.message }, { status: 503 });
      await audit(claims.user_id, "tenant.deleted", "tenant", parsed.data.tenantId);
      return Response.json({ ok: true });
    }
    if (parsed.data.action === "maintenance") {
      const { error } = await admin.from("platform_settings").upsert({ id: 1, maintenance_mode: parsed.data.enabled, updated_by: claims.user_id }, { onConflict: "id" });
      if (error) return Response.json({ error: error.message }, { status: 503 });
      await audit(claims.user_id, parsed.data.enabled ? "platform.maintenance_enabled" : "platform.maintenance_disabled", "platform", "maintenance");
      return Response.json({ ok: true, maintenance: parsed.data.enabled });
    }
    if (parsed.data.action === "plan-config") {
      const { error } = await admin.from("platform_plans").update({ monthly_price: parsed.data.monthlyPrice, feature_flags: parsed.data.featureFlags, updated_by: claims.user_id }).eq("id", parsed.data.planId);
      if (error) return Response.json({ error: error.message }, { status: 503 });
      await audit(claims.user_id, "platform.plan_modified", "plan", parsed.data.planId, { monthly_price: parsed.data.monthlyPrice, feature_flags: parsed.data.featureFlags });
      return Response.json({ ok: true });
    }
    if (parsed.data.action === "promo") {
      const expiresAt = new Date(Date.now() + parsed.data.extensionDays * 86400000).toISOString();
      const { error } = await admin.from("tenant_promotions").insert({ tenant_id: parsed.data.tenantId, extension_days: parsed.data.extensionDays, expires_at: expiresAt, note: parsed.data.note ?? null, granted_by: claims.user_id });
      if (error) return Response.json({ error: error.message }, { status: 503 });
      await audit(claims.user_id, "tenant.promo_granted", "tenant", parsed.data.tenantId, { extension_days: parsed.data.extensionDays, expires_at: expiresAt });
      return Response.json({ ok: true, expiresAt });
    }
    if (parsed.data.action === "provision") {
      const { data: created, error: userError } = await admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true, user_metadata: { full_name: parsed.data.adminFullName } });
      if (userError || !created.user) return Response.json({ error: userError?.message ?? "Could not create administrator." }, { status: 400 });
      const { data: tenantId, error: provisionError } = await admin.rpc("provision_tenant", { company_name: parsed.data.companyName, owner_user_id: created.user.id, activation_code: null });
      if (provisionError || !tenantId) { await admin.auth.admin.deleteUser(created.user.id); return Response.json({ error: provisionError?.message ?? "Could not provision tenant." }, { status: 400 }); }
      const { data: warehouse } = await admin.from("warehouses").select("id").eq("tenant_id", tenantId).eq("is_main", true).maybeSingle();
      const { error: credentialError } = await admin.from("tenant_users").insert({ user_id: created.user.id, tenant_id: tenantId, warehouse_id: warehouse?.id ?? null, role: "owner", email: parsed.data.email, username: parsed.data.email.split("@")[0], identifier_normalized: normalizeIdentifier(parsed.data.email), password_hash: await hashCredential(parsed.data.password), allowed_warehouses: warehouse?.id ? [warehouse.id] : [] });
      if (credentialError) { await admin.auth.admin.deleteUser(created.user.id); return Response.json({ error: credentialError.message }, { status: 503 }); }
      const { error: planError } = await admin.from("tenants").update({ subscription_plan: parsed.data.subscriptionPlan }).eq("id", tenantId);
      if (planError) return Response.json({ error: planError.message }, { status: 503 });
      await audit(claims.user_id, "tenant.provisioned", "tenant", tenantId, { company_name: parsed.data.companyName, subscription_plan: parsed.data.subscriptionPlan });
      return Response.json({ ok: true, tenantId });
    }
    if (parsed.data.action === "impersonate") {
      const tenant = await admin.from("tenants").select("id, name").eq("id", parsed.data.tenantId).single();
      if (tenant.error) return Response.json({ error: "Tenant not found." }, { status: 404 });
      const response = NextResponse.json({ ok: true, tenant: tenant.data });
      const token = await createSessionToken({ user_id: claims.user_id, tenant_id: parsed.data.tenantId, tenant_name: tenant.data.name, warehouse_id: null, role: "owner", allowed_warehouses: [], token_type: "operator" }, "30m");
      response.cookies.set(OPERATOR_COOKIE, token, { ...secureCookie, maxAge: 1800 });
      await audit(claims.user_id, "tenant.impersonated", "tenant", parsed.data.tenantId, { mode: "read_write", expires_in_minutes: 30 });
      return response;
    }
    if (parsed.data.action === "reset-password") {
      const { data: owner } = await admin.from("tenant_users").select("user_id, email").eq("tenant_id", parsed.data.tenantId).eq("role", "owner").eq("is_active", true).limit(1).maybeSingle();
      if (!owner) return Response.json({ error: "Active tenant owner not found." }, { status: 404 });
      const temporaryPassword = `SF-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}!`;
      const { error } = await admin.from("tenant_users").update({ password_hash: await hashCredential(temporaryPassword), pin_hash: null }).eq("user_id", owner.user_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await admin.auth.admin.updateUserById(owner.user_id, { password: temporaryPassword });
      await audit(claims.user_id, "tenant.owner_password_reset", "tenant", parsed.data.tenantId);
      return Response.json({ ok: true, email: owner.email, temporaryPassword });
    }
    const patch = parsed.data.action === "status" ? { status: parsed.data.status, ...(parsed.data.planStatus ? { plan_status: parsed.data.planStatus } : {}) } : parsed.data.action === "plan" ? { ...(parsed.data.planStatus ? { plan_status: parsed.data.planStatus } : {}), ...(parsed.data.subscriptionPlan ? { subscription_plan: parsed.data.subscriptionPlan } : {}) } : { max_users: parsed.data.maxUsers, max_warehouses: parsed.data.maxWarehouses };
    const { error } = await admin.from("tenants").update(patch).eq("id", parsed.data.tenantId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    await audit(claims.user_id, `tenant.${parsed.data.action}`, "tenant", parsed.data.tenantId, patch);
    return Response.json({ ok: true });
  } catch (error) { return unauthorized(error); }
}