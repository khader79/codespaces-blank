"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { StoreFlowUser } from "@/lib/demo-auth";
import { hasPermission, normalizeRole, type Permission } from "@/lib/rbac";

type AuthContextValue = {
  user: StoreFlowUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<StoreFlowUser | string>;
  signOut: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoreFlowUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json().catch(() => null) as { user?: StoreFlowUser | null; M_ID?: string } | null;
      const sessionUser = body?.user ?? null;
      if (sessionUser && typeof sessionUser === "object") setUser(sessionUser);
    }).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  async function signIn(identifier: string, password: string): Promise<StoreFlowUser | string> {
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return body.error ?? "Invalid credentials.";
    const signedInUser = body?.user as StoreFlowUser | undefined;
    if (!signedInUser || typeof signedInUser !== "object") return "Invalid authentication response.";
    setUser(signedInUser);
    return signedInUser;
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }

  const can = (permission: Permission) => Boolean(user && hasPermission(normalizeRole(user.role), permission));
  return <AuthContext.Provider value={{ user, loading, signIn, signOut, hasPermission: can }}>{children}</AuthContext.Provider>;
}

export function usePermission(permission: Permission) {
  return useAuth().hasPermission(permission);
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}