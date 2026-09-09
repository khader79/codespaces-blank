"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Building2,
  Eye,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { PageHeader, Panel, Pill, Skeleton, StatCard, type Tone } from "@/components/super-admin";

type Company = {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended";
  plan_status: string;
  subscription_plan: string;
  max_users: number;
  max_warehouses: number;
  admin_email: string | null;
  created_at: string;
  user_count: number;
  warehouse_count: number;
  product_count: number;
};

type AuditLog = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Dashboard = {
  tenants: Company[];
  plans: { id: string; name: string; monthly_price: number }[];
  maintenance: boolean;
  metrics: {
    activeTenants: number;
    totalCompanies: number;
    totalUsers: number;
    totalWarehouses: number;
    totalProducts: number;
    mrr: number;
    transactionVolume: number;
    suspendedTenants: number;
    systemHealth: string;
  };
  analytics: {
    monthlySignups: { month: string; count: number }[];
    revenueTrend: { month: string; revenue: number }[];
    salesVolume: { month: string; count: number; revenue: number }[];
    planDistribution: { name: string; value: number }[];
    roleDistribution: { name: string; value: number }[];
    auditActivity: { month: string; count: number }[];
  };
  topTenants: { id: number; name: string; slug: string; status: string; user_count: number; warehouse_count: number; product_count: number }[];
  auditLogs: AuditLog[];
  error?: string;
};

const DONUT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#64748b"];
const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Enterprise" };

function compactCurrency(value: number) {
  return `$${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function monthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toLocaleDateString("en", { month: "short" });
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function actionColor(action: string): Tone {
  if (action.includes("delete") || action.includes("ban")) return "red";
  if (action.includes("create") || action.includes("provision")) return "emerald";
  if (action.includes("update") || action.includes("modify") || action.includes("change")) return "blue";
  if (action.includes("reset") || action.includes("impersonate")) return "amber";
  return "slate";
}

function Chart({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Skeleton className="h-64 w-full" />;
  return <div className="h-64 w-full">{children}</div>;
}

export default function SuperAdminPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/super-admin", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as Dashboard;
    if (!response.ok) setError(body.error ?? "Unable to load platform data.");
    else setData(body);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function action(body: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch("/api/super-admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError((await response.json().catch(() => ({}))).error ?? "Action failed.");
    } else {
      await load();
    }
    setSaving(false);
  }

  async function impersonate(company: Company) {
    setSaving(true);
    const response = await fetch("/api/super-admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "impersonate", tenantId: company.id }),
    });
    if (!response.ok) {
      setError((await response.json().catch(() => ({}))).error ?? "Impersonation failed.");
      setSaving(false);
    } else {
      router.push("/admin");
    }
  }

  function confirmDelete(company: Company) {
    if (window.confirm(`Delete ${company.name}? This permanently removes the company and its associated data.`)) {
      action({ action: "delete", tenantId: company.id });
    }
  }

  const spark = useMemo(() => data?.analytics.monthlySignups.map((point) => point.count) ?? [], [data]);
  const revenueSpark = useMemo(() => data?.analytics.revenueTrend.map((point) => point.revenue) ?? [], [data]);
  const mrrTrend = useMemo(() => {
    const trend = data?.analytics.revenueTrend ?? [];
    if (trend.length < 2) return null;
    const previous = trend[trend.length - 2].revenue;
    const current = trend[trend.length - 1].revenue;
    if (previous <= 0) return null;
    const delta = ((current - previous) / previous) * 100;
    return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
  }, [data]);
  const signupsThisMonth = data?.analytics.monthlySignups.at(-1)?.count ?? 0;
  const revenueTotal = useMemo(() => (data?.analytics.revenueTrend ?? []).reduce((sum, point) => sum + point.revenue, 0), [data]);

  if (loading && !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
        <div className="h-24 w-full max-w-2xl space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Unable to load platform data."}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
      <PageHeader
        eyebrow="Platform"
        title="Command Center"
        description="A live pulse of every company, identity, warehouse, and transaction on the platform."
        actions={
          <>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />New company
            </button>
          </>
        }
      />

      {error && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Total companies" value={data.metrics.totalCompanies} tone="blue" points={spark} sub={`${signupsThisMonth} new this month`} />
        <StatCard icon={Activity} label="Active tenants" value={data.metrics.activeTenants} tone="emerald" sub={`${data.metrics.suspendedTenants} suspended`} />
        <StatCard icon={Users} label="Total users" value={data.metrics.totalUsers} tone="violet" sub={`${data.analytics.roleDistribution[0]?.name ?? "owner"} leads roles`} />
        <StatCard icon={Layers} label="MRR" value={compactCurrency(data.metrics.mrr)} tone="amber" points={revenueSpark} trend={mrrTrend ?? undefined} sub={`${compactCurrency(revenueTotal)} revenue, 12 mo`} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Revenue trend"
          description="Monthly invoiced revenue across all tenants"
          action={<Pill tone="blue">{compactCurrency(revenueTotal)} · 12 months</Pill>}
        >
          <Chart>
            <ResponsiveContainer>
              <AreaChart data={data.analytics.revenueTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => compactCurrency(v)} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(value) => [compactCurrency(Number(value)), "Revenue"]} labelFormatter={monthLabel} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </Chart>
        </Panel>

        <Panel title="Plan distribution" description="Companies by subscription plan">
          <Chart>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.analytics.planDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={4} strokeWidth={0}>
                  {data.analytics.planDistribution.map((entry, index) => (
                    <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Chart>
          <div className="mt-4 space-y-2">
            {data.analytics.planDistribution.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                  {PLAN_LABELS[entry.name] ?? entry.name}
                </span>
                <span className="font-bold text-slate-900">{entry.value}</span>
              </div>
            ))}
            {data.analytics.planDistribution.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No companies yet.</p>}
          </div>
        </Panel>

        <Panel title="New signups" description="Companies created per month" action={<Pill tone="violet">{signupsThisMonth} this month</Pill>}>
          <Chart>
            <ResponsiveContainer>
              <BarChart data={data.analytics.monthlySignups} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [value, "Signups"]} labelFormatter={monthLabel} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Chart>
        </Panel>

        <Panel title="Sales volume" description="Units sold per month" action={<Pill tone="emerald">{compactNumber(data.metrics.transactionVolume)} this month</Pill>}>
          <Chart>
            <ResponsiveContainer>
              <AreaChart data={data.analytics.salesVolume} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="sales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(value) => [compactNumber(Number(value)), "Sales"]} labelFormatter={monthLabel} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5} fill="url(#sales)" />
              </AreaChart>
            </ResponsiveContainer>
          </Chart>
        </Panel>

        <Panel title="Top tenants" description="Ranked by active users" action={<Pill tone="slate">{data.tenants.length} total</Pill>}>
          <div className="space-y-3">
            {data.topTenants.map((tenant, index) => (
              <div key={tenant.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50/60">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${index === 0 ? "bg-amber-50 text-amber-600" : index === 1 ? "bg-slate-100 text-slate-600" : index === 2 ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{tenant.name}</p>
                  <p className="font-mono text-[10px] text-slate-400">{tenant.slug}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{tenant.user_count}</span>
                  <span className="inline-flex items-center gap-1"><Warehouse className="h-3 w-3" />{tenant.warehouse_count}</span>
                  <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{tenant.product_count}</span>
                </div>
              </div>
            ))}
            {data.topTenants.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No tenants yet.</p>}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Companies"
          description="Direct control over every registered workspace"
          noPad
          action={<Pill tone="slate">{data.tenants.length} companies</Pill>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3">Assets</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.tenants.map((company) => (
                  <tr key={company.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{company.name}</p>
                          <p className="font-mono text-xs text-slate-400">{company.admin_email ?? company.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Pill tone={company.subscription_plan === "enterprise" ? "violet" : company.subscription_plan === "pro" ? "blue" : "slate"}>
                        {company.subscription_plan ?? "free"}
                      </Pill>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{company.user_count}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {company.warehouse_count ?? "—"} wh · {company.product_count ?? "—"} sku
                    </td>
                    <td className="px-5 py-4">
                      <Pill tone={company.status === "active" ? "emerald" : "red"}>{company.status}</Pill>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(company.created_at))}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => impersonate(company)}
                          title={`Log in as ${company.name}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-50"
                        >
                          <Eye className="h-3.5 w-3.5" />Enter
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => action({ action: "status", tenantId: company.id, status: company.status === "active" ? "suspended" : "active" })}
                          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                        >
                          {company.status === "active" ? "Suspend" : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => confirmDelete(company)}
                          title="Delete company"
                          className="rounded-lg px-2 py-1.5 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.tenants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">No companies registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Admin activity" description="Latest privileged actions" noPad action={<Pill tone="blue">live</Pill>}>
          <div className="divide-y divide-slate-100">
            {data.auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-slate-50/60">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Activity className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={actionColor(log.action)}>{log.action}</Pill>
                    <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(log.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {log.target_type && <span className="font-semibold text-slate-600">{log.target_type}{log.target_id ? ` #${log.target_id}` : ""}</span>}
                    {" · "}
                    <span className="font-mono">{log.actor_user_id.slice(0, 8)}…</span>
                  </p>
                </div>
              </div>
            ))}
            {data.auditLogs.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-400">No privileged activity recorded.</p>}
          </div>
        </Panel>
      </section>

      {creating && (
        <CreateCompany
          onClose={() => setCreating(false)}
          onCreated={async (name, slug, email, password) => {
            setSaving(true);
            const response = await fetch("/api/super-admin", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "provision", companyName: name, adminFullName: email.split("@")[0], email, password, subscriptionPlan: "free" }),
            });
            if (!response.ok) {
              setError((await response.json().catch(() => ({}))).error ?? "Provisioning failed.");
            } else {
              setCreating(false);
              await load();
            }
            setSaving(false);
          }}
        />
      )}
    </main>
  );
}

function CreateCompany({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, slug: string, email: string, password: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function autoSlug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onCreated(name, slug || autoSlug(name), email, password);
          setSubmitting(false);
        }}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Create company</h2>
            <p className="mt-1 text-sm text-slate-500">Provision a workspace and administrator account.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-6 block text-sm font-semibold text-slate-700">
          Company name
          <input
            required
            value={name}
            onChange={(e) => { setName(e.target.value); if (!slug || slug === autoSlug(name)) setSlug(autoSlug(e.target.value)); }}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Acme Corp"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Slug
          <input
            required
            value={slug}
            onChange={(e) => setSlug(autoSlug(e.target.value))}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="acme-corp"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Admin email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="admin@acme.com"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Password
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Minimum 8 characters"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Creating..." : "Create company"}
          </button>
        </div>
      </form>
    </div>
  );
}