"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Search, X } from "lucide-react";

type PlatformAuditLog = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type TenantAuditLog = {
  id: string;
  tenant_id: number | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Source = "platform" | "tenant" | "all";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function actionColor(action: string): string {
  if (/(cancel|delete|ban|reject)/.test(action)) return "bg-red-50 text-red-700";
  if (/(create|provision|approve|paid)/.test(action)) return "bg-emerald-50 text-emerald-700";
  if (/(update|modify|change|sync|rotate|refresh)/.test(action)) return "bg-blue-50 text-blue-700";
  if (/(reset|impersonat|promo|grant)/.test(action)) return "bg-amber-50 text-amber-700";
  if (/(checkout|subscription|billing|webhook)/.test(action)) return "bg-violet-50 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

function Pill({ label }: { label: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${actionColor(label)}`}>{label}</span>;
}

export default function SuperAdminLogsPage() {
  const [platformLogs, setPlatformLogs] = useState<PlatformAuditLog[]>([]);
  const [tenantLogs, setTenantLogs] = useState<TenantAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<Source>("all");
  const [actor, setActor] = useState("");
  const [actionFilter, setActionFilter] = useState("any");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/super-admin", { cache: "no-store" });
    const body = (await response.json().catch(() => ({})));
    if (!response.ok) setError(body.error ?? "Failed to load audit logs.");
    else {
      setPlatformLogs(body.auditLogs ?? []);
      setTenantLogs(body.tenantAuditLogs ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const log of platformLogs) set.add(log.action);
    for (const log of tenantLogs) set.add(log.action);
    return Array.from(set).sort();
  }, [platformLogs, tenantLogs]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const actorQuery = actor.trim().toLowerCase();

    const matches = (action: string, target: string | null, targetId: string | null, actorId: string) => {
      if (actionFilter !== "any" && action !== actionFilter) return false;
      if (actorQuery && !actorId.toLowerCase().includes(actorQuery)) return false;
      if (!q) return true;
      return (
        action.toLowerCase().includes(q) ||
        (target ?? "").toLowerCase().includes(q) ||
        (targetId ?? "").toLowerCase().includes(q) ||
        actorId.toLowerCase().includes(q)
      );
    };

    const platform = (source === "all" || source === "platform" ? platformLogs : []).flatMap<{
      id: string;
      kind: "platform";
      createdAt: string;
      action: string;
      actorId: string;
      tenantLabel: string;
      target: string | null;
      targetId: string | null;
      metadata: Record<string, unknown> | null;
      ip: string | null;
    }>((log) =>
      matches(log.action, log.target_type, log.target_id, log.actor_user_id)
        ? [{
            id: `p-${log.id}`,
            kind: "platform",
            createdAt: log.created_at,
            action: log.action,
            actorId: log.actor_user_id,
            tenantLabel: "Platform",
            target: log.target_type,
            targetId: log.target_id,
            metadata: log.metadata,
            ip: null,
          }]
        : []
    );

    const tenant = (source === "all" || source === "tenant" ? tenantLogs : []).flatMap<{
      id: string;
      kind: "tenant";
      createdAt: string;
      action: string;
      actorId: string;
      tenantLabel: string;
      target: string | null;
      targetId: string | null;
      metadata: Record<string, unknown> | null;
      ip: string | null;
    }>((log) =>
      matches(log.action, log.entity_type, log.entity_id, log.user_id ?? "")
        ? [{
            id: `t-${log.id}`,
            kind: "tenant",
            createdAt: log.created_at,
            action: log.action,
            actorId: log.user_id ?? "—",
            tenantLabel: log.tenant_id ? `Tenant #${log.tenant_id}` : "Tenant",
            target: log.entity_type,
            targetId: log.entity_id,
            metadata: log.metadata,
            ip: log.ip_address,
          }]
        : []
    );

    return [...platform, ...tenant].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [platformLogs, tenantLogs, search, source, actor, actionFilter]);

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            <Activity className="h-3.5 w-3.5" /> Audit
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Audit Logs</h1>
          <p className="mt-2 text-sm text-slate-500">
            Every privileged platform action and tenant business mutation is recorded
            here. Logs are immutable — they cannot be edited or deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="mt-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by action, target, actor..."
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>

        <label className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            className="h-full bg-transparent outline-none"
            aria-label="Log source"
          >
            <option value="all">All sources</option>
            <option value="platform">Platform admin</option>
            <option value="tenant">Tenant business</option>
          </select>
        </label>

        <label className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="max-w-52 bg-transparent outline-none"
            aria-label="Filter by action"
          >
            <option value="any">Any action</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </label>

        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="Actor id..."
          className="h-10 w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400"
        />

        <span className="text-xs font-bold text-slate-400">
          {rows.length} of {platformLogs.length + tenantLogs.length} entries
        </span>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Loading audit logs...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            {search || actionFilter !== "any" || actor
              ? "No logs match your filters."
              : "No audit log entries found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">IP</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {log.createdAt ? formatTime(log.createdAt) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                          log.kind === "platform"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {log.tenantLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Pill label={log.action} />
                    </td>
                    <td className="px-5 py-4">
                      {log.target ? (
                        <span className="text-slate-700">
                          {log.target}
                          {log.targetId && (
                            <span className="ml-1 font-mono text-xs text-slate-400">
                              #{log.targetId}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-40 truncate px-5 py-4 font-mono text-xs text-slate-500">
                      {log.actorId === "—" ? "—" : `${log.actorId.slice(0, 8)}…`}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-400">
                      {log.ip ?? "—"}
                    </td>
                    <td className="max-w-[300px] px-5 py-4">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <details className="group">
                          <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline">
                            View metadata
                          </summary>
                          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-emerald-300">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Showing {rows.length} of {platformLogs.length + tenantLogs.length} audit entries
          </div>
        )}
      </section>
    </main>
  );
}