"use client";

import type { ReactNode } from "react";
import { usePermission } from "@/components/AuthProvider";
import type { Permission } from "@/lib/rbac";

export function Can({ do: permission, children, fallback = null }: { do: Permission; children: ReactNode; fallback?: ReactNode }) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}

export { usePermission };