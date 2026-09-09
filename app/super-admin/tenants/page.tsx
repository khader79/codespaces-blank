"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Clock, Eye, KeyRound, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Modal, PageHeader, Panel, Pill, type Tone } from "@/components/super-admin";

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

type Filter = "all" | "active" | "suspended";

export default function SuperAdminTenantsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [extendTarget, setExtendTarget] = useState<Company | null>(null);
  const [extensionDays, setExtensionDays] = useState("30");
  const router = useRouter();

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/super-admin", { cache: "no-store" });
    const body = (await response.json().catch(() => ({})));
    if (!response.ok) setError(body.error ?? "Failed to load tenants.");
    else setCompanies(body.tenants ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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

  async function tenantAction(body: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/super-admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; temporaryPassword?: string };
    if (!response.ok) {
      setError(result.error ?? "Action failed.");
    } else {
      await load();
      if (result.temporaryPassword) {
        window.alert(`Temporary password for ${successMessage}: ${result.temporaryPassword}\n\nThe owner must change it on first sign-in.`);
      } else {
        setSelectedMessage(successMessage);
      }
    }
    setSaving(false);
  }

  const [selectedMessage, setSelectedMessage] = useState("");

  async function extendTrial() {
    if (!extendTarget) return;
    await tenantAction(
      { action: "promo", tenantId: extendTarget.id, extensionDays: Number(extensionDays) || 30, note: "Extended from command center" },
      `${extendTarget.name}: trial extended by ${Number(extensionDays) || 30} days`
    );
    setExtendTarget(null);
  }

  const counts = useMemo(() => {
    const active = companies.filter((company) => company.status === "active").length;
    return { all: companies.length, active, suspended: companies.length - active };
  }, [companies]);

  const filtered = companies.filter((company) => {
    if (filter !== "all" && company.status !== filter) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      company.name.toLowerCase().includes(needle) ||
      company.slug.toLowerCase().includes(needle) ||
      (company.admin_email ?? "").toLowerCase().includes(needle)
    );
  });

  function planTone(plan: string): Tone {
    if (plan === "enterprise") return "violet";
    if (plan === "pro") return "blue";
    return "slate";
  }

  const filterTabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "active", label: "Active", count: counts.active },
    { key: "suspended", label: "Suspended", count: counts.suspended },
  ];

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
      <PageHeader
        eyebrow="Management"
        title="Companies & Tenants"
        description="Every registered workspace — subscription, limits, trial, and lifecycle controls."
        actions={
          <>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
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
          <button type="button" onClick={() => setError("")} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}
      {selectedMessage && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span>{selectedMessage}</span>
          <button type="button" onClick={() => setSelectedMessage("")} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === tab.key ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {tab.label}
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${filter === tab.key ? "bg-white/20" : "bg-slate-100"}`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <label className="flex h-10 w-full max-w-md flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name, slug, or email..." className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <span className="text-xs font-bold text-slate-400">{filtered.length} of {companies.length}</span>
      </div>

      <Panel className="mt-6" noPad>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Admin</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Users</th>
                <th className="px-5 py-3">Assets</th>
                <th className="px-5 py-3">Limits</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((company) => (
                <tr key={company.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{company.name}</p>
                        <p className="font-mono text-xs text-slate-400">ID #{company.id} · /{company.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{company.admin_email ?? "—"}</td>
                  <td className="px-5 py-4">
                    <Pill tone={planTone(company.subscription_plan ?? "free")}>{company.subscription_plan ?? "free"}</Pill>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{company.user_count}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{company.warehouse_count ?? "—"} wh · {company.product_count ?? "—"} sku</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{(company.max_users ?? "∞")} users / {(company.max_warehouses ?? "∞")} wh</td>
                  <td className="px-5 py-4">
                    <Pill tone={company.status === "active" ? "emerald" : "red"}>{company.status}</Pill>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(company.created_at))}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" disabled={saving} onClick={() => impersonate(company)} title={`Log in as ${company.name}`} className="rounded-lg px-2 py-1.5 text-amber-600 transition hover:bg-amber-50">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={saving} onClick={() => tenantAction({ action: "status", tenantId: company.id, status: company.status === "active" ? "suspended" : "active" }, `${company.name} ${company.status === "active" ? "suspended" : "activated"}`)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100">
                        {company.status === "active" ? "Suspend" : "Activate"}
                      </button>
                      <button type="button" disabled={saving} onClick={() => tenantAction({ action: "plan", tenantId: company.id, subscriptionPlan: company.subscription_plan === "free" ? "pro" : company.subscription_plan === "pro" ? "enterprise" : "free" }, `${company.name} plan rotated`)} className="rounded-lg px-2 py-1.5 text-blue-600 transition hover:bg-blue-50" title="Rotate plan">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={saving} onClick={() => setExtendTarget(company)} className="rounded-lg px-2 py-1.5 text-violet-600 transition hover:bg-violet-50" title="Extend trial / grant days">
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={saving} onClick={() => window.confirm(`Reset owner password for ${company.name}?`) && tenantAction({ action: "reset-password", tenantId: company.id }, company.name)} className="rounded-lg px-2 py-1.5 text-amber-600 transition hover:bg-amber-50" title="Reset owner password">
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={saving} onClick={() => window.confirm(`Delete ${company.name}? This permanently removes all data.`) && tenantAction({ action: "delete", tenantId: company.id }, `${company.name} deleted`)} className="rounded-lg px-2 py-1.5 text-red-500 transition hover:bg-red-50" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">{search || filter !== "all" ? "No companies match your filter." : "No companies registered yet."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {creating && (
        <CreateCompanyModal
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

      {extendTarget && (
        <Modal title={`Extend trial — ${extendTarget.name}`} description="Grant additional subscription days (logged in tenant_promotions)." onClose={() => setExtendTarget(null)}>
          <label className="block text-sm font-semibold text-slate-700">
            Extension days
            <input
              type="number"
              min={1}
              max={3650}
              value={extensionDays}
              onChange={(e) => setExtensionDays(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setExtendTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={extendTrial} disabled={saving} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">
              {saving ? "Extending..." : "Extend trial"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function CreateCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, slug: string, email: string, password: string) => Promise<void> }) {
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
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          await onCreated(name, slug || autoSlug(name), email, password);
          setSubmitting(false);
        }}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Create company</h2>
            <p className="mt-1 text-sm text-slate-500">Provision a new workspace and administrator.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <label className="mt-6 block text-sm font-semibold text-slate-700">
          Company name
          <input required value={name} onChange={(e) => { setName(e.target.value); if (!slug || slug === autoSlug(name)) setSlug(autoSlug(e.target.value)); }} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Acme Corp" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Slug
          <input required value={slug} onChange={(e) => setSlug(autoSlug(e.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="acme-corp" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Admin email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="admin@acme.com" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Password
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Minimum 8 characters" />
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