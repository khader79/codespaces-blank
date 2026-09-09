-- StoreFlow 011: enterprise hardening.
-- (1) Stripe billing sync columns on tenants + plans.
-- (2) Strict JWT-scoped RLS bound to auth.jwt() tenant_id across every
--     tenant-owned table (audit_logs stays append-only / immutable).
-- (3) Immutable trigger on audit_logs & system_audit_logs (no UPDATE/DELETE).
-- (4) Multi-warehouse realtime publication for live stock updates.

-- ---------------------------------------------------------------------------
-- 1) Subscription / billing sync columns
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none';
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_subscription_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_subscription_status_check
  CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused'));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;

ALTER TABLE platform_plans ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Demo tenant: keep feature gates open for the canonical signed-in workspace.
UPDATE tenants
SET subscription_plan = 'pro', plan_status = 'active', subscription_status = 'active'
WHERE id = 1;

-- Stripe webhook delivery log (idempotency + audit of billing events).
CREATE TABLE IF NOT EXISTS billing_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  tenant_id bigint REFERENCES tenants(id) ON DELETE SET NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON billing_events FROM anon, authenticated;
GRANT ALL ON billing_events TO service_role;

-- ---------------------------------------------------------------------------
-- 2) tenant_id isolation columns on legacy store-scoped tables
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE inventory i SET tenant_id = w.tenant_id
FROM warehouses w WHERE w.id = i.warehouse_id AND i.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_warehouse ON inventory(tenant_id, warehouse_id);

ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE stock_transfers s SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = s.store_id AND s.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_created ON stock_transfers(tenant_id, created_at DESC);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE customers c SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = c.store_id AND c.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenant_id, name);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE payments p SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = p.store_id AND p.tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON payments(tenant_id, paid_at DESC);

ALTER TABLE returns ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE returns r SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = r.store_id AND r.tenant_id IS NULL;
ALTER TABLE return_lines ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE return_lines rl SET tenant_id = r.tenant_id
FROM returns r WHERE r.id = rl.return_id AND rl.tenant_id IS NULL;

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE journal_entries j SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = j.store_id AND j.tenant_id IS NULL;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE journal_lines jl SET tenant_id = je.tenant_id
FROM journal_entries je WHERE je.id = jl.journal_entry_id AND jl.tenant_id IS NULL;

ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE chart_of_accounts ca SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = ca.store_id AND ca.tenant_id IS NULL;

ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE inventory_lots il SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = il.store_id AND il.tenant_id IS NULL;

ALTER TABLE product_bom_lines ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id);
UPDATE product_bom_lines pb SET tenant_id = p.tenant_id
FROM products p WHERE p.id = pb.parent_product_id AND pb.tenant_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Immutable audit trail
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id bigint REFERENCES tenants(id) ON DELETE SET NULL;
UPDATE audit_logs a SET tenant_id = st.tenant_id
FROM stores st WHERE st.id = a.store_id AND a.tenant_id IS NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(action, entity_type, created_at DESC);

CREATE OR REPLACE FUNCTION enforce_immutable_audit() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable; they cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_immutable_audit();

DROP TRIGGER IF EXISTS system_audit_logs_immutable ON system_audit_logs;
CREATE TRIGGER system_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_immutable_audit();

CREATE OR REPLACE FUNCTION audit_log_set_tenant_id() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.store_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM stores WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_fill_tenant ON audit_logs;
CREATE TRIGGER audit_logs_fill_tenant
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_log_set_tenant_id();

-- ---------------------------------------------------------------------------
-- 4) Strict JWT-scoped RLS for every tenant-owned table
-- ---------------------------------------------------------------------------
-- The app_tenant_id()/app_role() helpers below resolve the tenant strictly
-- from auth.jwt(), so every policy below is bound to the signed tenant_id.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_tenant_access ON products;
CREATE POLICY products_tenant_access ON products USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warehouses_tenant_access ON warehouses;
CREATE POLICY warehouses_tenant_access ON warehouses USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stores_tenant_access ON stores;
CREATE POLICY stores_tenant_access ON stores USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_warehouse_access ON inventory;
CREATE POLICY inventory_warehouse_access ON inventory USING (can_access_warehouse(tenant_id, warehouse_id)) WITH CHECK (can_access_warehouse(tenant_id, warehouse_id));

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_transfers_tenant_access ON stock_transfers;
CREATE POLICY stock_transfers_tenant_access ON stock_transfers USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customers_tenant_access ON customers;
CREATE POLICY customers_tenant_access ON customers USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_tenant_access ON payments;
CREATE POLICY payments_tenant_access ON payments USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS returns_tenant_access ON returns;
CREATE POLICY returns_tenant_access ON returns USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS return_lines_tenant_access ON return_lines;
CREATE POLICY return_lines_tenant_access ON return_lines USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_entries_tenant_access ON journal_entries;
CREATE POLICY journal_entries_tenant_access ON journal_entries USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS journal_lines_tenant_access ON journal_lines;
CREATE POLICY journal_lines_tenant_access ON journal_lines USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chart_of_accounts_tenant_access ON chart_of_accounts;
CREATE POLICY chart_of_accounts_tenant_access ON chart_of_accounts USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_lots_warehouse_access ON inventory_lots;
CREATE POLICY inventory_lots_warehouse_access ON inventory_lots USING (can_access_warehouse(tenant_id, warehouse_id)) WITH CHECK (can_access_warehouse(tenant_id, warehouse_id));

ALTER TABLE product_bom_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_bom_lines_tenant_access ON product_bom_lines;
CREATE POLICY product_bom_lines_tenant_access ON product_bom_lines USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));

ALTER TABLE inventory_cost_layers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_cost_layers_warehouse_access ON inventory_cost_layers;
CREATE POLICY inventory_cost_layers_warehouse_access ON inventory_cost_layers USING (can_access_warehouse(tenant_id, warehouse_id)) WITH CHECK (can_access_warehouse(tenant_id, warehouse_id));

-- financial_account_balances is a view (no RLS on views)
-- guard in case it is ever converted to a table so this stays correct
DO $$
BEGIN
  IF (SELECT true FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'financial_account_balances' AND c.relkind = 'r') THEN
    ALTER TABLE financial_account_balances ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS financial_account_balances_tenant_access ON financial_account_balances;
    CREATE POLICY financial_account_balances_tenant_access ON financial_account_balances USING (can_access_tenant(tenant_id)) WITH CHECK (can_access_tenant(tenant_id));
  END IF;
END $$;

-- audit_logs: readable and appendable by the owning tenant, never editable.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT TO authenticated USING (can_access_tenant(tenant_id));
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO authenticated WITH CHECK (can_access_tenant(tenant_id));
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;

-- ---------------------------------------------------------------------------
-- 5) Realtime: stream inventory mutations to connected dashboards
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_stock;
    ALTER PUBLICATION supabase_realtime ADD TABLE stock_ledger;
    ALTER PUBLICATION supabase_realtime ADD TABLE stock_transfers;
    ALTER PUBLICATION supabase_realtime ADD TABLE warehouses;
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;