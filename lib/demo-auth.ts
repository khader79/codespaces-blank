export const DEMO_ADMIN_EMAIL = "admin@storeflow.local";
export const DEMO_ADMIN_PASSWORD = "StoreFlowAdmin123!";

export type StoreFlowUser = {
  id?: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  tenant_id?: number;
  warehouse_id?: number | null;
  assigned_warehouse_id?: number | null;
  allowed_warehouses?: number[];
  role: string;
};

export function isDemoAdmin(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD;
}