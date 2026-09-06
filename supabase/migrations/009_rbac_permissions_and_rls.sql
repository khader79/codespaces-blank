-- StoreFlow 009: canonical roles, dynamic permissions, and JWT-scoped RLS.
CREATE TABLE IF NOT EXISTS permissions (
  key text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role text NOT NULL,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key),
  CHECK (role IN ('SUPER_ADMIN', 'TENANT_OWNER', 'WAREHOUSE_MANAGER', 'CASHIER'))
);

INSERT INTO permissions (key, description) VALUES
  ('inventory:view', 'View inventory'),
  ('inventory:view_cost', 'View inventory cost'),
  ('inventory:edit', 'Edit inventory'),
  ('inventory:transfer', 'Transfer stock between warehouses'),
  ('sales:view', 'View sales'),
  ('sales:create', 'Create sales'),
  ('sales:apply_discount', 'Apply sales discounts'),
  ('finance:view', 'View finance data'),
  ('finance:write', 'Create and edit finance records'),
  ('reports:export', 'Export reports'),
  ('settings:manage_users', 'Manage tenant users'),
  ('settings:manage_billing', 'Manage billing'),
  ('super_admin:impersonate', 'Impersonate tenant users')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key)
SELECT role, permission_key FROM (VALUES
  ('SUPER_ADMIN', 'inventory:view'), ('SUPER_ADMIN', 'inventory:view_cost'), ('SUPER_ADMIN', 'inventory:edit'),
  ('SUPER_ADMIN', 'inventory:transfer'), ('SUPER_ADMIN', 'sales:view'), ('SUPER_ADMIN', 'sales:create'),
  ('SUPER_ADMIN', 'sales:apply_discount'), ('SUPER_ADMIN', 'finance:view'), ('SUPER_ADMIN', 'finance:write'),
  ('SUPER_ADMIN', 'reports:export'), ('SUPER_ADMIN', 'settings:manage_users'), ('SUPER_ADMIN', 'settings:manage_billing'),
  ('SUPER_ADMIN', 'super_admin:impersonate'),
  ('TENANT_OWNER', 'inventory:view'), ('TENANT_OWNER', 'inventory:view_cost'), ('TENANT_OWNER', 'inventory:edit'),
  ('TENANT_OWNER', 'inventory:transfer'), ('TENANT_OWNER', 'sales:view'), ('TENANT_OWNER', 'sales:create'),
  ('TENANT_OWNER', 'sales:apply_discount'), ('TENANT_OWNER', 'finance:view'), ('TENANT_OWNER', 'finance:write'),
  ('TENANT_OWNER', 'reports:export'), ('TENANT_OWNER', 'settings:manage_users'), ('TENANT_OWNER', 'settings:manage_billing'),
  ('WAREHOUSE_MANAGER', 'inventory:view'), ('WAREHOUSE_MANAGER', 'inventory:view_cost'), ('WAREHOUSE_MANAGER', 'inventory:edit'),
  ('WAREHOUSE_MANAGER', 'inventory:transfer'), ('WAREHOUSE_MANAGER', 'sales:view'), ('WAREHOUSE_MANAGER', 'sales:create'),
  ('WAREHOUSE_MANAGER', 'reports:export'),
  ('CASHIER', 'inventory:view'), ('CASHIER', 'sales:view'), ('CASHIER', 'sales:create')
) AS seed(role, permission_key)
ON CONFLICT DO NOTHING;

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permissions_read_authenticated ON permissions;
CREATE POLICY permissions_read_authenticated ON permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS role_permissions_read_authenticated ON role_permissions;
CREATE POLICY role_permissions_read_authenticated ON role_permissions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION app_role() RETURNS text AS $$
  SELECT COALESCE(NULLIF(auth.jwt() ->> 'role', ''), 'CASHIER');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS bigint AS $$
  SELECT NULLIF(auth.jwt() ->> 'tenant_id', '')::bigint;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_assigned_warehouse_id() RETURNS bigint AS $$
  SELECT NULLIF(COALESCE(auth.jwt() ->> 'assigned_warehouse_id', auth.jwt() ->> 'warehouse_id'), '')::bigint;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION has_permission(required_permission text) RETURNS boolean AS $$
  SELECT app_role() = 'SUPER_ADMIN' OR EXISTS (
    SELECT 1 FROM role_permissions
    WHERE role = app_role() AND permission_key = required_permission
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_access_tenant(target_tenant_id bigint) RETURNS boolean AS $$
  SELECT app_role() = 'SUPER_ADMIN' OR target_tenant_id = app_tenant_id();
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION can_access_warehouse(target_tenant_id bigint, target_warehouse_id bigint) RETURNS boolean AS $$
  SELECT can_access_tenant(target_tenant_id)
    AND (app_role() IN ('SUPER_ADMIN', 'TENANT_OWNER')
      OR app_role() = 'WAREHOUSE_MANAGER' AND (
        target_warehouse_id = app_assigned_warehouse_id()
        OR target_warehouse_id = ANY(COALESCE((auth.jwt() -> 'allowed_warehouses')::bigint[], '{}'::bigint[]))
      )
      OR app_role() = 'CASHIER' AND target_warehouse_id = app_assigned_warehouse_id());
$$ LANGUAGE sql STABLE;

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users_rbac_access ON tenant_users;
CREATE POLICY tenant_users_rbac_access ON tenant_users USING (
  app_role() = 'SUPER_ADMIN' OR (tenant_id = app_tenant_id() AND (
    user_id = auth.uid() OR has_permission('settings:manage_users')
  ))
) WITH CHECK (app_role() = 'SUPER_ADMIN' OR (tenant_id = app_tenant_id() AND has_permission('settings:manage_users')));

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_rbac_access ON tenants;
CREATE POLICY tenants_rbac_access ON tenants USING (app_role() = 'SUPER_ADMIN' OR id = app_tenant_id());

ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_stock_rbac_access ON inventory_stock;
CREATE POLICY inventory_stock_rbac_access ON inventory_stock USING (can_access_warehouse(tenant_id, warehouse_id)) WITH CHECK (can_access_warehouse(tenant_id, warehouse_id) AND has_permission('inventory:edit'));

ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_ledger_rbac_access ON stock_ledger;
CREATE POLICY stock_ledger_rbac_access ON stock_ledger USING (can_access_warehouse(tenant_id, warehouse_id)) WITH CHECK (can_access_warehouse(tenant_id, warehouse_id) AND has_permission('inventory:edit'));

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_rbac_access ON sales;
CREATE POLICY sales_rbac_access ON sales USING (can_access_tenant(tenant_id) AND has_permission('sales:view')) WITH CHECK (can_access_tenant(tenant_id) AND has_permission('sales:create'));

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_rbac_access ON invoices;
CREATE POLICY invoices_rbac_access ON invoices USING (can_access_tenant(tenant_id) AND has_permission('finance:view')) WITH CHECK (can_access_tenant(tenant_id) AND has_permission('finance:write'));