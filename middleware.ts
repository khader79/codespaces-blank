import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const roleRank: Record<string, number> = { CASHIER: 1, WAREHOUSE_MANAGER: 2, TENANT_OWNER: 3, SUPER_ADMIN: 4 };
const legacyRoles: Record<string, string> = { admin: "SUPER_ADMIN", owner: "TENANT_OWNER", manager: "WAREHOUSE_MANAGER", warehouse_worker: "WAREHOUSE_MANAGER", cashier: "CASHIER" };

function canonicalRole(value: unknown) {
  if (typeof value !== "string") return null;
  return legacyRoles[value.toLowerCase()] ?? value.toUpperCase();
}

function jwtSecret() {
  const value = process.env.AUTH_JWT_SECRET;
  return value && value.length >= 32 ? new TextEncoder().encode(value) : null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requiredRole = path.startsWith("/super-admin") ? "SUPER_ADMIN" : path.startsWith("/settings") || path.startsWith("/finance") ? "TENANT_OWNER" : path.startsWith("/inventory/transfers") ? "WAREHOUSE_MANAGER" : path.startsWith("/pos") ? "CASHIER" : null;
  if (!requiredRole) return NextResponse.next();
  const token = request.cookies.get("storeflow-access")?.value;
  const secret = jwtSecret();
  if (!token || !secret) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, request.url));
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const role = canonicalRole(payload.role);
    if (payload.token_type !== "access" || !role || roleRank[role] < roleRank[requiredRole]) throw new Error("Forbidden");
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/403", request.url));
  }
}

export const config = { matcher: ["/super-admin/:path*", "/settings/:path*", "/finance/:path*", "/inventory/transfers/:path*", "/pos/:path*"] };