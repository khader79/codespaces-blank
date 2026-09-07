"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { STORE_ID } from "@/lib/tenant";
import CommandBar from "@/components/CommandBar";
import UserGuide from "@/components/UserGuide";
import { getWarehouses, type Warehouse } from "@/lib/db";
import { cacheWarehouses, getCachedWarehouses } from "@/lib/db-offline";
import { NAVIGATION_GROUPS } from "@/config/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function AppHeader() {
  const { t, currency, setCurrency } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkReady, setDarkReady] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState("");
  const [activeTenant, setActiveTenant] = useState("1");

  useEffect(() => {
    let active = true;
    getCachedWarehouses(STORE_ID).then((cached) => {
      if (!active || cached.length === 0) return;
      setWarehouses(cached.map((warehouse) => ({ id: warehouse.id, store_id: warehouse.storeId, name: warehouse.name, location: warehouse.location, is_main: warehouse.is_main })));
      const main = cached.find((row) => row.is_main) ?? cached[0];
      if (main) setActiveWarehouse(String(main.id));
    }).catch(() => undefined);
    getWarehouses(STORE_ID).then(async (rows) => {
      await cacheWarehouses(rows);
      if (!active) return;
      setWarehouses(rows);
      const main = rows.find((row) => row.is_main) ?? rows[0];
      if (main) setActiveWarehouse(String(main.id));
    }).catch(() => undefined);
    return () => { active = false; };
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
          {NAVIGATION_GROUPS.map((group) => <div key={group.labelKey} className="mb-6"><p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? "text-center" : ""}`}>{collapsed ? t(group.labelKey).slice(0, 1) : t(group.labelKey)}</p>{group.links.map((link) => { const Icon = link.icon; return <Link key={link.href} href={link.href} prefetch onMouseEnter={() => router.prefetch(link.href)} onFocus={() => router.prefetch(link.href)} title={collapsed ? t(link.labelKey) : undefined} onClick={() => setMobileOpen(false)} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive(link) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon className="h-4 w-4 shrink-0" /><span className={collapsed ? "sr-only" : "truncate"}>{t(link.labelKey)}</span></Link>; })}</div>)}
        </nav>
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="m-3 flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-slate-500 transition hover:bg-slate-50" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="text-xs">Collapse</span></>}</button>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-950/30 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-slate-200 bg-white shadow-xl transition-transform md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5"><span className="font-bold text-slate-950">StoreFlow</span><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5 text-slate-500" /></button></div>
        <nav className="overflow-y-auto px-3 py-5">{NAVIGATION_GROUPS.flatMap((group) => group.links).map((link) => { const Icon = link.icon; return <Link key={link.href} href={link.href} prefetch onMouseEnter={() => router.prefetch(link.href)} onFocus={() => router.prefetch(link.href)} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><Icon className="h-4 w-4" />{t(link.labelKey)}</Link>; })}</nav>
      </aside>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl md:ms-64">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3"><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button><CommandBar /></div>
        <div className="flex items-center gap-2">
          <UserGuide />
          <select value={activeTenant} onChange={(event) => setActiveTenant(event.target.value)} aria-label={t("selectCompany" as never)} className="hidden h-9 max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 lg:block">
            <option value="1">{t("mainStore" as never)}</option>
          </select>
          <select value={activeWarehouse} onChange={(event) => setActiveWarehouse(event.target.value)} aria-label={t("selectWarehouse" as never)} className="hidden h-9 max-w-40 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 sm:block">
            {warehouses.length === 0 && <option value="">{t("warehouse" as never)}</option>}
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            aria-label={t("currency" as never)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => { setDarkReady((value) => !value); document.documentElement.classList.toggle("dark"); }} className="hidden h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:block" aria-label={t("toggleTheme" as never)}>{darkReady ? t("light" as never) : t("dark" as never)}</button>
          <LanguageSwitcher />

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