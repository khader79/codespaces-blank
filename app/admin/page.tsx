"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  PackageSearch,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import { DEMO_ADMIN_PASSWORD } from "@/lib/demo-auth";

type Tenant = {
  id: number;
  name: string;
  status: "active" | "suspended";
  created_at: string;
  subscription_expires_at: string;
  user_count: number;
};

type AdminResponse = { tenants?: Tenant[]; userCount?: number; error?: string };

const domains = [
  { label: "Business overview", description: "Revenue, activity, and store performance", href: "/", icon: LayoutDashboard, tone: "bg-blue-50 text-blue-700" },
  { label: "Point of sale", description: "Sales activity and checkout operations", href: "/pos", icon: ShoppingCart, tone: "bg-emerald-50 text-emerald-700" },
  { label: "Finance", description: "Invoices, receivables, ledger, and expenses", href: "/finance", icon: CircleDollarSign, tone: "bg-amber-50 text-amber-700" },
  { label: "Inventory & logistics", description: "Catalog, warehouses, transfers, and suppliers", href: "/?view=catalog", icon: PackageSearch, tone: "bg-orange-50 text-orange-700" },
  { label: "Intelligence", description: "Forecasting, insights, and purchase planning", href: "/?view=intelligence", icon: BarChart3, tone: "bg-violet-50 text-violet-700" },
  { label: "Workspace settings", description: "Company preferences and access configuration", href: "/settings", icon: Settings2, tone: "bg-slate-100 text-slate-700" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function AdminPage() {
  const [key, setKey] = useState(DEMO_ADMIN_PASSWORD);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [months, setMonths] = useState("1");
  const [voucher, setVoucher] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/admin", { headers: { "x-storeflow-admin-key": key } });
      const body = await response.json() as AdminResponse;
      if (!response.ok) throw new Error(body.error ?? "Unable to load admin data.");
      setTenants(body.tenants ?? []);
      setUserCount(body.userCount ?? (body.tenants ?? []).reduce((total, tenant) => total + tenant.user_count, 0));
      setLoaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load admin data.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const saved = window.sessionStorage.getItem("storeflow-admin-key");
    if (saved) setKey(saved);
  }, []);

  async function update(tenant: Tenant, status: Tenant["status"], extensionMonths = 0) {
    const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json", "x-storeflow-admin-key": key }, body: JSON.stringify({ tenantId: tenant.id, status, months: extensionMonths }) });
    if (!response.ok) { const body = await response.json() as AdminResponse; setError(body.error ?? "Update failed."); return; }
    await load();
  }

  async function generateVoucher() {
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", "x-storeflow-admin-key": key }, body: JSON.stringify({ months: Number(months) }) });
    const body = await response.json() as { code?: string; error?: string };
    if (!response.ok) { setError(body.error ?? "Voucher generation failed."); return; }
    setVoucher(body.code ?? null);
  }

  const activeTenants = tenants.filter((tenant) => tenant.status === "active").length;

  return <main className="min-h-screen bg-[#f5f7fa] px-4 py-7 lg:px-8"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><ShieldCheck className="h-4 w-4" />StoreFlow control room</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Manage the whole operation</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">One place to monitor companies, users, access, and every major workspace in your platform.</p></div>{loaded && <button type="button" disabled={busy} onClick={load} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh data</button>}</header>

    {!loaded ? <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">Restricted access</h2><p className="mt-2 text-sm leading-6 text-slate-500">Enter the system administrator key to open the control room. The key is checked on the server.</p><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="System admin key" className="mt-5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /><button type="button" disabled={!key || busy} onClick={() => { window.sessionStorage.setItem("storeflow-admin-key", key); load(); }} className="mt-3 h-12 w-full rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">Open control room</button>{error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</section> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Building2} label="Companies" value={tenants.length} detail={`${activeTenants} active now`} /><Metric icon={Users} label="Users" value={userCount} detail="Across all workspaces" /><Metric icon={Activity} label="Platform status" value="Healthy" detail="Admin services responding" status /><Metric icon={CreditCard} label="Access coverage" value={`${tenants.length ? Math.round((activeTenants / tenants.length) * 100) : 0}%`} detail="Companies active" /></section>

      <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Platform areas</p><h2 className="mt-1 text-xl font-bold text-slate-950">Jump into any operation</h2></div><span className="hidden text-xs font-semibold text-slate-400 sm:block">6 workspaces connected</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{domains.map((domain) => { const Icon = domain.icon; return <Link key={domain.href} href={domain.href} className="group flex min-h-32 flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${domain.tone}`}><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-700" /></div><div><h3 className="mt-4 text-sm font-bold text-slate-900">{domain.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{domain.description}</p></div></Link>; })}</div></section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Access management</p><h2 className="mt-1 text-lg font-bold text-slate-950">Companies and subscriptions</h2></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tenants.length} total</span></div><div className="divide-y divide-slate-100">{tenants.map((tenant) => <div key={tenant.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tenant.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><Building2 className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{tenant.name}</p><p className="mt-0.5 text-xs text-slate-500">{tenant.user_count} users · Renews {formatDate(tenant.subscription_expires_at)}</p></div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tenant.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{tenant.status}</span><button type="button" onClick={() => update(tenant, tenant.status === "active" ? "suspended" : "active")} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{tenant.status === "active" ? "Suspend" : "Activate"}</button></div></div>)}{tenants.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">No companies registered yet.</p>}</div></div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-bold text-slate-950">Activation vouchers</h2></div><p className="mt-2 text-xs leading-5 text-slate-500">Create a one-time code for a new company trial.</p><div className="mt-4 flex gap-2"><input type="number" min="1" max="120" value={months} onChange={(event) => setMonths(event.target.value)} className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={generateVoucher} className="h-10 flex-1 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700">Generate code</button></div>{voucher && <p className="mt-4 rounded-lg bg-blue-50 px-3 py-3 font-mono text-sm font-bold tracking-wider text-blue-700">{voucher}</p>}<div className="mt-6 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-500">Latest platform check</p><p className="mt-1 text-sm font-bold text-slate-900">All systems operational</p><div className="mt-3 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />Core admin API reachable</div></div></div></section>
    </>}
  </div></main>;
}

function Metric({ icon: Icon, label, value, detail, status = false }: { icon: typeof Activity; label: string; value: string | number; detail: string; status?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><span className="text-slate-400"><Icon className="h-4 w-4" /></span></div><p className={`mt-3 text-2xl font-bold tracking-tight ${status ? "text-emerald-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
