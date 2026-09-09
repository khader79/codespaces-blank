"use client";

import { useEffect, useState } from "react";
import { Database, HardDrive, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { PageHeader, Panel, Pill, Skeleton, type Tone } from "@/components/super-admin";

type Services = { name: string; status: string }[] | null;
type FeatureFlags = Record<string, boolean>;
type Plan = { id: string; name: string; monthly_price: number; feature_flags: FeatureFlags | null; updated_at: string | null };

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? "bg-amber-500" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function SuperAdminSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [services, setServices] = useState<Services>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { monthly_price: string; feature_flags: FeatureFlags }>>({});

  async function load() {
    setLoading(true);
    setError("");
    const [infrastructure, dashboard] = await Promise.all([
      fetch("/api/super-admin/infrastructure", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/super-admin", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    setMaintenance(Boolean(infrastructure?.maintenance));
    setServices(infrastructure?.services ?? null);
    setPlans(dashboard?.plans ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const plan of plans) {
        if (!next[plan.id]) {
          next[plan.id] = { monthly_price: String(plan.monthly_price ?? 0), feature_flags: { ...(plan.feature_flags ?? {}) } };
        }
      }
      return next;
    });
  }, [plans]);

  const allFeatureKeys = Array.from(new Set(plans.flatMap((plan) => Object.keys(plan.feature_flags ?? {}))));

  async function project(options: { url: string; method: string; body?: unknown; onOk?: (body: Record<string, unknown>) => void }) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        setError(String(body.error ?? "Request failed."));
      } else {
        options.onOk?.(body);
      }
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMaintenance() {
    await project({
      url: "/api/super-admin/infrastructure",
      method: "PATCH",
      body: { action: "maintenance", enabled: !maintenance },
      onOk: (body) => {
        setMaintenance(Boolean(body.maintenance));
        setMessage(`Maintenance mode ${body.maintenance ? "enabled" : "disabled"}. ${body.maintenance ? "Tenant traffic now redirects to /maintenance." : "Tenant traffic restored."}`);
      },
    });
  }

  async function flushCache() {
    await project({
      url: "/api/super-admin/infrastructure",
      method: "PATCH",
      body: { action: "flush-cache" },
      onOk: () => setMessage("Redis cache flushed successfully."),
    });
  }

  async function savePlan(plan: Plan) {
    const draft = drafts[plan.id];
    if (!draft) return;
    await project({
      url: "/api/super-admin",
      method: "PATCH",
      body: {
        action: "plan-config",
        planId: plan.id,
        monthlyPrice: Number(draft.monthly_price) || 0,
        featureFlags: draft.feature_flags,
      },
      onOk: () => setMessage(`${plan.name} plan updated and audited.`),
    });
  }

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
      <PageHeader
        eyebrow="System"
        title="Settings & Configuration"
        description="Platform-wide controls: availability, caching, subscription plans, and environment information."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {(message || error) && (
        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <Panel title="Maintenance mode" description="Re-routes all non-privileged traffic to a scheduled-maintenance page.">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Wrench className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{maintenance ? "Maintenance is active" : "System is operational"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {maintenance ? "Super admins, login, and API remain reachable." : "Turning this on immediately gates tenant dashboards."}
                    </p>
                  </div>
                </div>
                <Switch checked={maintenance} onChange={toggleMaintenance} disabled={busy} />
              </div>
            </Panel>

            <Panel title="Cache" description="In-memory fast-path used by middleware and rate limiting.">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <HardDrive className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Redis cache{" "}
                      <span className="font-semibold text-emerald-600">
                        {services?.find((service) => service.name === "Cache")?.status === "not configured" ? "(not configured)" : "(configured)"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Flushing clears cached feature flags and the maintenance fast-path.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={flushCache}
                  disabled={busy}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Flush cache
                </button>
              </div>
            </Panel>
          </section>

          <Panel
            className="mt-4"
            title="Subscription plans"
            description="Pricing and entitlements exposed to every workspace"
            noPad
            action={<Pill tone="blue">{plans.length} plans</Pill>}
          >
            {plans.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">No plans configured yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Plan</th>
                      <th className="px-5 py-3">Monthly price ($)</th>
                      <th className="px-5 py-3">Feature flags</th>
                      <th className="px-5 py-3">Updated</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plans.map((plan) => {
                      const draft = drafts[plan.id] ?? {
                        monthly_price: String(plan.monthly_price ?? 0),
                        feature_flags: { ...(plan.feature_flags ?? {}) },
                      };
                      const tone: Tone = plan.id === "enterprise" ? "violet" : plan.id === "pro" ? "blue" : "slate";
                      return (
                        <tr key={plan.id} className="align-top transition hover:bg-slate-50/60">
                          <td className="px-5 py-4">
                            <Pill tone={tone}>{plan.name}</Pill>
                            <p className="mt-1 font-mono text-[10px] text-slate-400">{plan.id}</p>
                          </td>
                          <td className="px-5 py-4">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft.monthly_price}
                              onChange={(e) =>
                                setDrafts((current) => ({ ...current, [plan.id]: { ...draft, monthly_price: e.target.value } }))
                              }
                              className="h-9 w-28 rounded-lg border border-slate-200 px-2 text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              {allFeatureKeys.map((feature) => (
                                <button
                                  key={feature}
                                  type="button"
                                  onClick={() =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [plan.id]: { ...draft, feature_flags: { ...draft.feature_flags, [feature]: !draft.feature_flags[feature] } },
                                    }))
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                                    draft.feature_flags[feature]
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-400"
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${draft.feature_flags[feature] ? "bg-emerald-500" : "bg-slate-300"}`} />
                                  {feature.replaceAll("_", " ")}
                                </button>
                              ))}
                              {allFeatureKeys.length === 0 && <span className="text-xs text-slate-400">No flags configured.</span>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                            {plan.updated_at ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(plan.updated_at)) : "—"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => savePlan(plan)}
                              className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <section className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title="Database" description="Supabase Postgres, service-role access.">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Database className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {services?.find((service) => service.name === "Database")?.status ?? "operational"}
                  </p>
                  <p className="text-xs text-slate-500">Inspect via the Database Inspector.</p>
                </div>
              </div>
            </Panel>
            <Panel title="Authentication" description="Privileged platform session.">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {services?.find((service) => service.name === "Authentication")?.status ?? "operational"}
                  </p>
                  <p className="text-xs text-slate-500">All privileged actions are audited.</p>
                </div>
              </div>
            </Panel>
            <Panel title="Environment" description="Runtime context for this deployment.">
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Platform</dt>
                  <dd className="font-semibold text-slate-700">{typeof window !== "undefined" ? window.location.origin : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Service role</dt>
                  <dd className="font-semibold text-slate-700">{process.env.NEXT_PUBLIC_SUPABASE_URL ? "connected" : "not configured"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Cache</dt>
                  <dd className="font-semibold text-slate-700">{process.env.UPSTASH_REDIS_REST_URL ? "upstash-redis" : "unset"}</dd>
                </div>
              </dl>
            </Panel>
          </section>
        </>
      )}
    </main>
  );
}