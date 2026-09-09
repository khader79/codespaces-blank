import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { readMaintenance } from "@/lib/maintenance";
import { parseTenantHost } from "@/lib/tenant";

const roleRank: Record<string, number> = { CASHIER: 1, WAREHOUSE_MANAGER: 2, TENANT_OWNER: 3, SUPER_ADMIN: 4 };
const legacyRoles: Record<string, string> = { admin: "SUPER_ADMIN", owner: "TENANT_OWNER", manager: "WAREHOUSE_MANAGER", warehouse_worker: "WAREHOUSE_MANAGER", cashier: "CASHIER" };

const TENANT_CACHE_TTL_MS = 60_000;
const tenantCache = new Map<string, { id: number; slug: string; at: number }>();

function canonicalRole(value: unknown) {
  if (typeof value !== "string") return null;
  return legacyRoles[value.toLowerCase()] ?? value.toUpperCase();
}

function jwtSecret() {
  const value = process.env.AUTH_JWT_SECRET;
  return value && value.length >= 32 ? new TextEncoder().encode(value) : null;
}

async function verify(token: string, secret: Uint8Array) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  return payload as Record<string, unknown>;
}

/** Resolve `[tenant].storeflow.io` -> tenant row via the platform service key. */
async function resolveTenantBySlug(slug: string): Promise<{ id: number; slug: string } | null> {
  const cached = tenantCache.get(slug);
  if (cached && Date.now() - cached.at < TENANT_CACHE_TTL_MS) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(
      `${url}/rest/v1/tenants?select=id,slug&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as { id: number; slug: string }[];
    const row = rows[0];
    if (!row) return null;
    tenantCache.set(slug, { id: row.id, slug: row.slug, at: Date.now() });
    return { id: row.id, slug: row.slug };
  } catch {
    return null;
  }
}

const platformHostRoutes = ["/super-admin", "/admin", "/api/super-admin"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const secret = jwtSecret();

  // ---- Wildcard subdomain routing: [tenant].storeflow.io ----
  const host = request.headers.get("host");
  const tenantHost = parseTenantHost(host);

  let tenant: { id: number; slug: string } | null = null;
  if (tenantHost.isTenantHost && tenantHost.subdomain) {
    tenant = await resolveTenantBySlug(tenantHost.subdomain);
    if (!tenant) return new NextResponse("Tenant not found", { status: 404 });
    if (platformHostRoutes.some((prefix) => path.startsWith(prefix))) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const scope = (response: NextResponse): NextResponse => {
    if (tenant) {
      response.headers.set("x-storeflow-tenant-id", String(tenant.id));
      response.headers.set("x-storeflow-tenant-slug", tenant.slug);
    }
    return response;
  };

  // ---- Global maintenance mode gate (tenant traffic only) ----
  const maintenanceAllowed =
    path.startsWith("/super-admin") ||
    path.startsWith("/api") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path === "/maintenance" ||
    path === "/403";

  if (!maintenanceAllowed && (await readMaintenance())) {
    const accessToken = request.cookies.get("storeflow-access")?.value;
    const operatorToken = request.cookies.get("storeflow-operator")?.value;
    try {
      if (accessToken && secret) {
        const access = await verify(accessToken, secret);
        if (canonicalRole(access.role) === "SUPER_ADMIN") return scope(NextResponse.next());
      }
      if (operatorToken && secret) {
        await verify(operatorToken, secret);
        return scope(NextResponse.next());
      }
    } catch {
      // fallthrough to maintenance redirect
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  // ---- Authentication / authorization ----
  const isDefaultEntry = path === "/" || path === "/dashboard";
  const requiredRole = path.startsWith("/super-admin") ? "SUPER_ADMIN" : path.startsWith("/settings") || path.startsWith("/finance") ? "TENANT_OWNER" : path.startsWith("/inventory/transfers") ? "WAREHOUSE_MANAGER" : path.startsWith("/pos") ? "CASHIER" : null;

  const token = request.cookies.get("storeflow-access")?.value;
  const operatorToken = request.cookies.get("storeflow-operator")?.value;

  if (!requiredRole && !isDefaultEntry) return scope(NextResponse.next());
  if (isDefaultEntry && (!token || !secret)) return scope(NextResponse.next());
  if (!token || !secret) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, request.url));

  try {
    const payload = await verify(token, secret);
    const role = canonicalRole(payload.role);

    let operator: Record<string, unknown> | null = null;
    if (operatorToken && secret) {
      try {
        const op = await verify(operatorToken, secret);
        if (op.token_type === "operator") operator = op;
      } catch {
        operator = null;
      }
    }

    const effectiveRole = operator ? canonicalRole(operator.role) : role;

    // Subdomain <-> tenant binding: a signed-in user may only act on their own
    // tenant's subdomain, unless they are an impersonating platform operator.
    const operatorTenantId = Number(operator?.tenant_id ?? 0);
    if (tenant && effectiveRole !== "SUPER_ADMIN") {
      const sessionTenantId = operator ? operatorTenantId : Number(payload.tenant_id ?? 0);
      if (sessionTenantId !== tenant.id) return NextResponse.redirect(new URL("/403", request.url));
    }

    if (!operator && role === "SUPER_ADMIN" && !path.startsWith("/super-admin")) {
      if (tenantHost.isTenantHost) {
        return NextResponse.redirect(
          new URL(`/super-admin`, `${request.nextUrl.protocol}//${tenantHost.baseDomain}`)
        );
      }
      return NextResponse.redirect(new URL("/super-admin", request.url));
    }
    if (isDefaultEntry) return scope(NextResponse.next());
    if (!requiredRole) return scope(NextResponse.next());
    if (!effectiveRole || roleRank[effectiveRole] < roleRank[requiredRole]) throw new Error("Forbidden");
    return scope(NextResponse.next());
  } catch {
    return NextResponse.redirect(new URL("/403", request.url));
  }
}

export const config = { matcher: ["/((?!api|_next|_dev|favicon.ico|icon.svg|robots.txt|.*\\..*).*)"] };