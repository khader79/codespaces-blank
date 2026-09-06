export const STORE_ROLES = ["SUPER_ADMIN", "TENANT_OWNER", "WAREHOUSE_MANAGER", "CASHIER"] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

export const PERMISSIONS = [
  "inventory:view",
  "inventory:view_cost",
  "inventory:edit",
  "inventory:transfer",
  "sales:view",
  "sales:create",
  "sales:apply_discount",
  "finance:view",
  "finance:write",
  "reports:export",
  "settings:manage_users",
  "settings:manage_billing",
  "super_admin:impersonate",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_RANK: Record<StoreRole, number> = {
  CASHIER: 1,
  WAREHOUSE_MANAGER: 2,
  TENANT_OWNER: 3,
  SUPER_ADMIN: 4,
};

const ROLE_PERMISSIONS: Record<StoreRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  TENANT_OWNER: PERMISSIONS.filter((permission) => permission !== "super_admin:impersonate"),
  WAREHOUSE_MANAGER: ["inventory:view", "inventory:view_cost", "inventory:edit", "inventory:transfer", "sales:view", "sales:create", "reports:export"],
  CASHIER: ["inventory:view", "sales:view", "sales:create"],
};

export function normalizeRole(value: unknown): StoreRole | null {
  if (typeof value !== "string") return null;
  const legacyRoles: Record<string, StoreRole> = {
    admin: "SUPER_ADMIN",
    super_admin: "SUPER_ADMIN",
    owner: "TENANT_OWNER",
    tenant_owner: "TENANT_OWNER",
    manager: "WAREHOUSE_MANAGER",
    warehouse_manager: "WAREHOUSE_MANAGER",
    warehouse_worker: "WAREHOUSE_MANAGER",
    cashier: "CASHIER",
  };
  return legacyRoles[value.toLowerCase()] ?? null;
}

export function hasPermission(role: StoreRole | string | null | undefined, permission: Permission): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? ROLE_PERMISSIONS[normalizedRole].includes(permission) : false;
}

export function getRolePermissions(role: StoreRole | string | null | undefined): Permission[] {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? [...ROLE_PERMISSIONS[normalizedRole]] : [];
}

export function parseRole(value: unknown): StoreRole {
  const role = normalizeRole(value);
  if (!role) throw new Error("A valid tenant role is required.");
  return role;
}

export function defaultWorkspace(role: StoreRole | string | null | undefined): string {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "SUPER_ADMIN") return "/super-admin";
  if (normalizedRole === "TENANT_OWNER") return "/settings";
  if (normalizedRole === "WAREHOUSE_MANAGER") return "/?view=transfers";
  return "/pos";
}

export function hasRoleAtLeast(role: StoreRole | string | null | undefined, required: StoreRole): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? ROLE_RANK[normalizedRole] >= ROLE_RANK[required] : false;
}