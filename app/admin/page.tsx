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
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  PackageSearch,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Search,
  Sparkles,
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
  const [query, setQuery] = useState("");

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
  const expiringTenants = tenants.filter((tenant) => new Date(tenant.subscription_expires_at).getTime() < Date.now() + 14 * 86400000);
  const filteredTenants = tenants.filter((tenant) => tenant.name.toLowerCase().includes(query.toLowerCase()));

  return <main className="min-h-screen bg-[#f5f7fa] text-slate-900"><div className="flex min-h-screen">
    {loaded && <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 px-5 py-6 text-white lg:flex"><div className="flex items-center gap-3 border-b border-white/10 pb-7"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-bold tracking-tight">StoreFlow</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admin console</p></div></div><nav className="mt-8 space-y-1"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p><RailItem icon={LayoutDashboard} label="Overview" active /><RailItem icon={Building2} label="Organizations" /><RailItem icon={Users} label="People & roles" /><RailItem icon={CreditCard} label="Billing" /><RailItem icon={Settings2} label="Configuration" /></nav><div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />All systems operational</div><p className="mt-2 text-xs leading-5 text-slate-400">Last checked just now</p><a href="/" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-white hover:text-blue-300">Open app <ExternalLink className="h-3 w-3" /></a></div></aside>}
    <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8"><div className="mx-auto max-w-[1440px]">
    {loaded && <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><Sparkles className="h-4 w-4" />Good morning, admin</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Platform overview</h1><p className="mt-1 text-sm text-slate-500">Your operation at a glance, with the next best action close at hand.</p></div><div className="flex items-center gap-2"> <a href="/" className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"><ExternalLink className="h-4 w-4" />Open StoreFlow</a><button type="button" disabled={busy} onClick={load} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh</button></div></header>}

    {!loaded ? <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white"><ShieldCheck className="h-5 w-5" /></div><h2 className="mt-5 text-xl font-bold text-slate-950">Restricted access</h2><p className="mt-2 text-sm leading-6 text-slate-500">Enter the system administrator key to open the control room. The key is checked on the server.</p><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="System admin key" className="mt-5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /><button type="button" disabled={!key || busy} onClick={() => { window.sessionStorage.setItem("storeflow-admin-key", key); load(); }} className="mt-3 h-12 w-full rounded-lg bg-slate-950 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">Open control room</button>{error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}</section> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Building2} label="Organizations" value={tenants.length} detail={`${activeTenants} active now`} /><Metric icon={Users} label="Total people" value={userCount} detail="Across all workspaces" /><Metric icon={Activity} label="Platform health" value="Healthy" detail="All admin services responding" status /><Metric icon={CreditCard} label="Active coverage" value={`${tenants.length ? Math.round((activeTenants / tenants.length) * 100) : 0}%`} detail={`${expiringTenants.length} need attention`} /></section>

      <section className="mt-8 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-blue-600 p-5 text-white shadow-sm md:col-span-2"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Admin briefing</p><h2 className="mt-2 text-xl font-bold">Keep every workspace moving.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Review access, check subscription health, and jump directly into the part of the business that needs you next.</p></div><LifeBuoy className="hidden h-9 w-9 text-blue-200 sm:block" /></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Needs attention</p><p className="mt-3 text-3xl font-bold text-amber-950">{expiringTenants.length}</p><p className="mt-1 text-sm text-amber-800">subscriptions expiring within 14 days</p></div></section>

      <section className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Quick access</p><h2 className="mt-1 text-xl font-bold text-slate-950">Move through StoreFlow</h2></div><span className="text-xs font-semibold text-slate-400">6 connected workspaces</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{domains.map((domain) => { const Icon = domain.icon; return <Link key={domain.href} href={domain.href} className="group flex min-h-32 flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className={`flex h-10 w-10 items-center justify-center rounded-lg ${domain.tone}`}><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-700" /></div><div><h3 className="mt-4 text-sm font-bold text-slate-900">{domain.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{domain.description}</p></div></Link>; })}</div></section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Access management</p><h2 className="mt-1 text-lg font-bold text-slate-950">Organizations</h2></div><label className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-400 sm:w-56"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an organization" className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400" /></label></div><div className="hidden grid-cols-[1fr_120px_140px_100px] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:grid"><span>Organization</span><span>People</span><span>Renewal</span><span>Status</span></div><div className="divide-y divide-slate-100">{filteredTenants.map((tenant) => <div key={tenant.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:grid sm:grid-cols-[1fr_120px_140px_100px]"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tenant.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><Building2 className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{tenant.name}</p><p className="mt-0.5 text-xs text-slate-500">ID {tenant.id}</p></div></div><span className="text-sm text-slate-600">{tenant.user_count} users</span><span className="text-sm text-slate-600">{formatDate(tenant.subscription_expires_at)}</span><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tenant.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{tenant.status}</span><button type="button" aria-label={`${tenant.status === "active" ? "Suspend" : "Activate"} ${tenant.name}`} onClick={() => update(tenant, tenant.status === "active" ? "suspended" : "active")} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{tenant.status === "active" ? "Suspend" : "Activate"}</button></div></div>)}{filteredTenants.length === 0 && <p className="px-5 py-8 text-sm text-slate-500">No matching organizations.</p>}</div></div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-bold text-slate-950">Activation vouchers</h2></div><p className="mt-2 text-xs leading-5 text-slate-500">Create a one-time code for a new company trial.</p><div className="mt-4 flex gap-2"><input type="number" min="1" max="120" value={months} onChange={(event) => setMonths(event.target.value)} className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={generateVoucher} className="h-10 flex-1 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700">Generate code</button></div>{voucher && <p className="mt-4 rounded-lg bg-blue-50 px-3 py-3 font-mono text-sm font-bold tracking-wider text-blue-700">{voucher}</p>}<div className="mt-6 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-500">Latest platform check</p><p className="mt-1 text-sm font-bold text-slate-900">All systems operational</p><div className="mt-3 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />Core admin API reachable</div></div></div></section>
    </>}
    </div></div></div></main>;
}

function RailItem({ icon: Icon, label, active = false }: { icon: typeof Activity; label: string; active?: boolean }) {
  return <a href="#" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</a>;
}

function Metric({ icon: Icon, label, value, detail, status = false }: { icon: typeof Activity; label: string; value: string | number; detail: string; status?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><span className="text-slate-400"><Icon className="h-4 w-4" /></span></div><p className={`mt-3 text-2xl font-bold tracking-tight ${status ? "text-emerald-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
