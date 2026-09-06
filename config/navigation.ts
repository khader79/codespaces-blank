import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Command,
  FileText,
  LayoutDashboard,
  PackageSearch,
  ShoppingCart,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { DictKey } from "@/lib/i18n";
import type { Permission } from "@/lib/rbac";

export type NavigationItem = {
  href: string;
  labelKey: DictKey;
  icon: LucideIcon;
  exact?: boolean;
  permission?: Permission;
};

export type NavigationGroup = {
  labelKey: DictKey;
  links: NavigationItem[];
};

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  { labelKey: "navCore", links: [{ href: "/", labelKey: "navDashboard", icon: LayoutDashboard, exact: true }, { href: "/pos", labelKey: "navPos", icon: ShoppingCart }] },
  { labelKey: "navInventory", links: [{ href: "/?view=catalog", labelKey: "navCatalog", icon: PackageSearch, permission: "inventory:view" }, { href: "/?view=transfers", labelKey: "navTransfers", icon: Truck, permission: "inventory:transfer" }, { href: "/?view=warehouses", labelKey: "navWarehouses", icon: Store, permission: "inventory:view" }, { href: "/?view=suppliers", labelKey: "navSuppliers", icon: Boxes, permission: "inventory:view" }] },
  { labelKey: "navFinanceGroup", links: [{ href: "/finance", labelKey: "navInvoices", icon: FileText, permission: "finance:view" }, { href: "/finance?view=receivables", labelKey: "navReceivables", icon: ClipboardList, permission: "finance:view" }, { href: "/finance?view=ledger", labelKey: "navLedger", icon: CircleDollarSign, permission: "finance:view" }, { href: "/finance?view=expenses", labelKey: "navExpenses", icon: CircleDollarSign, permission: "finance:view" }, { href: "/finance?view=reports", labelKey: "navReports", icon: BarChart3, permission: "reports:export" }] },
  { labelKey: "navAnalyticsGroup", links: [{ href: "/?view=intelligence", labelKey: "navIntelligence", icon: Command }, { href: "/?view=forecasting", labelKey: "navForecasting", icon: BarChart3 }, { href: "/?view=purchase-orders", labelKey: "navPurchaseOrders", icon: ClipboardList }] },
];