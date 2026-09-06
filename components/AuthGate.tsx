"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { normalizeRole } from "@/lib/rbac";

const publicPaths = new Set(["/", "/login", "/register", "/403"]);

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const role = normalizeRole(user?.role);
  const superAdminRoute = pathname.startsWith("/super-admin");
  const canAccessSuperAdmin = role === "SUPER_ADMIN";

  useEffect(() => {
    if (!loading && !user && !publicPaths.has(pathname)) router.replace("/");
    if (!loading && user && superAdminRoute && !canAccessSuperAdmin) router.replace("/403");
    if (!loading && user && pathname === "/admin" && user.role !== "admin") router.replace("/403");
  }, [canAccessSuperAdmin, loading, pathname, router, superAdminRoute, user]);

  if (loading && !publicPaths.has(pathname)) return <div className="min-h-screen bg-slate-950" />;
  if (!user && !publicPaths.has(pathname)) return null;
  if (superAdminRoute && !canAccessSuperAdmin) return null;
  if (pathname === "/admin" && user?.role !== "admin") return null;
  return <>{children}</>;
}