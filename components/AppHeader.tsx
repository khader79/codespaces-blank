"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Boxes, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, Command, FileText, LayoutDashboard, Menu, PackageSearch, ShoppingCart, Store, Truck, X } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { STORE_ID } from "@/lib/tenant";
import CommandBar from "@/components/CommandBar";
import UserGuide from "@/components/UserGuide";
import { getWarehouses, type Warehouse } from "@/lib/db";

const groups = [
  { label: "Core", links: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }, { href: "/pos", label: "POS / Terminal", icon: ShoppingCart }] },
  { label: "Inventory", links: [{ href: "/?view=catalog", label: "Catalog", icon: PackageSearch }, { href: "/?view=transfers", label: "Stock Transfers", icon: Truck }, { href: "/?view=warehouses", label: "Warehouses", icon: Store }, { href: "/?view=suppliers", label: "Suppliers", icon: Boxes }] },
  { label: "Finance & ERP", links: [{ href: "/finance", label: "Invoices", icon: FileText }, { href: "/finance?view=receivables", label: "Accounts Receivable", icon: ClipboardList }, { href: "/finance?view=ledger", label: "General Ledger", icon: CircleDollarSign }, { href: "/finance?view=expenses", label: "Expenses", icon: CircleDollarSign }, { href: "/finance?view=reports", label: "P&L Reports", icon: BarChart3 }] },
  { label: "Analytics & AI", links: [{ href: "/?view=intelligence", label: "Intelligence Hub", icon: Command }, { href: "/?view=forecasting", label: "Forecasting", icon: BarChart3 }, { href: "/?view=purchase-orders", label: "Auto-Purchase Orders", icon: ClipboardList }] },
];

export default function AppHeader() {
  const { t, locale, setLocale, currency, setCurrency } = useI18n();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkReady, setDarkReady] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState("");
  const [activeTenant, setActiveTenant] = useState("1");

  useEffect(() => {
    getWarehouses(STORE_ID).then((rows) => {
      setWarehouses(rows);
      const main = rows.find((row) => row.is_main) ?? rows[0];
      if (main) setActiveWarehouse(String(main.id));
    }).catch(() => undefined);
  }, []);

  const isActive = (link: { href: string; exact?: boolean }) => {
    if (link.href.includes("?")) return false;
    return link.exact ? pathname === link.href : pathname.startsWith(link.href);
  };

  return (
    <>
      <aside className={`fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-slate-200/80 bg-white transition-[width] duration-200 md:flex ${collapsed ? "w-20" : "w-64"}`}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white">S</span>
          {!collapsed && <span className="text-base font-bold tracking-tight text-slate-950">{t("appName")}</span>}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group) => <div key={group.label} className="mb-6"><p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? "text-center" : ""}`}>{collapsed ? group.label.slice(0, 1) : group.label}</p>{group.links.map((link) => { const Icon = link.icon; return <Link key={link.href} href={link.href} title={collapsed ? link.label : undefined} onClick={() => setMobileOpen(false)} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive(link) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{link.label}</span></Link>; })}</div>)}
        </nav>
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="m-3 flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-slate-500 transition hover:bg-slate-50" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="text-xs">Collapse</span></>}</button>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/30 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-slate-200 bg-white shadow-xl transition-transform md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5"><span className="font-bold text-slate-950">StoreFlow</span><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5 text-slate-500" /></button></div>
        <nav className="overflow-y-auto px-3 py-5">{groups.flatMap((group) => group.links).map((link) => { const Icon = link.icon; return <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><Icon className="h-4 w-4" />{link.label}</Link>; })}</nav>
      </aside>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl md:ms-64">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3"><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button><CommandBar /></div>
        <div className="flex items-center gap-2">
          <UserGuide />
          <select value={activeTenant} onChange={(event) => setActiveTenant(event.target.value)} aria-label="Select company" className="hidden h-9 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 lg:block">
            <option value="1">Main Store</option>
          </select>
          <select value={activeWarehouse} onChange={(event) => setActiveWarehouse(event.target.value)} aria-label="Select warehouse" className="hidden h-9 max-w-40 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 sm:block">
            {warehouses.length === 0 && <option value="">Warehouse</option>}
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            aria-label="Currency"
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => { setDarkReady((value) => !value); document.documentElement.classList.toggle("dark"); }} className="hidden h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:block" aria-label="Toggle dark mode readiness">{darkReady ? "Light" : "Dark"}</button>
          <div
            className="flex h-9 items-center overflow-hidden rounded-lg border border-gray-300 bg-white text-sm"
            role="group"
            aria-label="Language"
          >
            {(["en", "ar"] as Locale[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`h-full px-3 font-medium transition-colors ${
                  locale === code
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {code === "en" ? "EN" : "عربي"}
              </button>
            ))}
          </div>

          <span className="hidden items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t("storeBadge", { id: STORE_ID })}
          </span>
        </div>
        </div>
      </header>
    </>
  );
}