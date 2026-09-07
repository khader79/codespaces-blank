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
  metrics: { activeTenants: 0, mrr: 0, totalUsers: 0, transactionVolume: 0, systemHealth: "degraded" },
  auditLogs: [],
};

export async function GET() {
  try {
    await requireSuperAdmin();
    try {
      const admin = getSupabaseAdmin();
      const [tenantResult, userResult, salesResult, auditResult, warehouseResult, productResult, planResult, maintenanceResult] = await Promise.all([
        admin.from("tenants").select("id, name, slug, status, plan_status, subscription_plan, max_users, max_warehouses, created_at, subscription_expires_at").order("created_at", { ascending: false }),
        admin.from("tenant_users").select("tenant_id, email, role, created_at").eq("is_active", true),
        admin.from("sales").select("quantity, unit_price, sold_at"),
        admin.from("warehouses").select("id", { count: "exact", head: true }),
        admin.from("products").select("id", { count: "exact", head: true }),
        admin.from("system_audit_logs").select("id, actor_user_id, action, target_type, target_id, metadata, created_at").order("created_at", { ascending: false }).limit(50),
        admin.from("platform_plans").select("id, name, monthly_price, feature_flags, updated_at").order("monthly_price"),
        admin.from("platform_settings").select("maintenance_mode").eq("id", 1).maybeSingle(),
      ]);
      if (tenantResult.error || userResult.error || salesResult.error || auditResult.error) return Response.json(emptyDashboard);

      const tenants = tenantResult.data ?? [];
      const users = userResult.data ?? [];
      const sales = salesResult.data ?? [];
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
      const mrr = activeTenants.reduce((total, tenant) => total + (tenant?.plan_status === "active" ? 99 : 0), 0);
      return Response.json({
        tenants: tenants.map((tenant) => {
          const tenantId = Number(tenant?.id);
          const summary = usersByTenant.get(tenantId);
          return { ...tenant, admin_email: summary?.email ?? null, user_count: summary?.count ?? 0 };
        }),
        plans: planResult.error ? [] : planResult.data ?? [],
        maintenance: maintenanceResult.error ? false : Boolean(maintenanceResult.data?.maintenance_mode),
        metrics: { activeTenants: activeTenants.length, totalCompanies: tenants.length, totalUsers: users.length, totalWarehouses: warehouseResult.count ?? 0, totalProducts: productResult.count ?? 0, mrr, transactionVolume: monthlySales.length, systemHealth: "healthy" },
        auditLogs: auditResult.data ?? [],
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
      const token = await createSessionToken({ user_id: claims.user_id, tenant_id: parsed.data.tenantId, warehouse_id: null, role: "owner", allowed_warehouses: [], token_type: "operator" }, "30m");
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