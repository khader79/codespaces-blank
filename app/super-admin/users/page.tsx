"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, RefreshCw, Search, ShieldAlert, ShieldCheck, Undo2, UserRound, UserX, X } from "lucide-react";
import { PageHeader, Panel, Pill, type Tone } from "@/components/super-admin";

type User = {
  user_id: string;
  tenant_id: number;
  email: string | null;
  username: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

type Tenant = { id: number; name: string };

const ROLE_OPTIONS = ["owner", "super_admin", "manager", "warehouse_worker", "cashier", "accountant"];

const ROLE_TONES: Record<string, Tone> = {
  owner: "violet",
  super_admin: "blue",
  manager: "indigo",
  warehouse_worker: "amber",
  cashier: "slate",
  accountant: "emerald",
};

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function loadUsers(query: string) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/super-admin/users?search=${encodeURIComponent(query)}`, { cache: "no-store" });
    const body = (await response.json().catch(() => ({})));
    if (!response.ok) setError(body.error ?? "Failed to load users.");
    else setUsers(body.users ?? []);
    setLoading(false);
  }

  async function loadTenants() {
    const response = await fetch("/api/super-admin", { cache: "no-store" });
    const body = (await response.json().catch(() => ({})));
    if (response.ok) setTenants(body.tenants ?? []);
  }

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadUsers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function userAction(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/super-admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; temporaryPassword?: string; ok?: boolean } | null;
    if (result?.temporaryPassword) {
      window.alert(`Temporary password: ${result.temporaryPassword}\n\nThe user must change it on first sign-in.`);
    } else if (result?.error) {
      setError(result.error);
    } else if (response.ok) {
      setMessage("User updated.");
    } else {
      setError("Update failed.");
    }
    if (response.ok) {
      setUsers((current) =>
        current.map((u) =>
          u.user_id === body.userId
            ? {
                ...u,
                ...(body.action === "role" ? { role: body.role as string } : {}),
                ...(body.action === "ban" || body.action === "unban" ? { is_active: body.action === "unban" } : {}),
              }
            : u
        )
      );
    }
    setBusy(false);
  }

  const filtered = useMemo(() => {
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (statusFilter === "active" && !user.is_active) return false;
      if (statusFilter === "banned" && user.is_active) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (user.email ?? "").toLowerCase().includes(q) || (user.username ?? "").toLowerCase().includes(q) || user.user_id.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clippedPage = Math.min(page, pageCount);
  const pageUsers = filtered.slice((clippedPage - 1) * pageSize, clippedPage * pageSize);

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
      <PageHeader
        eyebrow="Management"
        title="All Users"
        description="Search identities across every tenant, adjust system roles, and restore access."
        actions={
          <button
            type="button"
            onClick={() => loadUsers(search)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
        }
      />

      {error && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}
      {message && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex h-10 w-full max-w-md flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email, username, or user ID..." className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-blue-500"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
        <span className="text-xs font-bold text-slate-400">{filtered.length} of {users.length}</span>
      </div>

      <Panel className="mt-6" noPad>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Identity</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">System role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageUsers.map((user) => (
                <tr key={user.user_id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{user.email ?? user.username ?? "Unknown"}</p>
                        <p className="max-w-[180px] truncate font-mono text-xs text-slate-400">{user.user_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{tenants.find((t) => t.id === user.tenant_id)?.name ?? `#${user.tenant_id}`}</td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      disabled={busy}
                      onChange={(e) => userAction({ action: "role", userId: user.user_id, role: e.target.value })}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold outline-none transition focus:border-blue-500"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={user.is_active ? "emerald" : "red"}>
                      {user.is_active ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                      {user.is_active ? "Active" : "Banned"}
                    </Pill>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {user.created_at ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(user.created_at)) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => userAction({ action: user.is_active ? "ban" : "unban", userId: user.user_id })}
                        className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${user.is_active ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                        title={user.is_active ? "Ban user" : "Unban user"}
                      >
                        {user.is_active ? <UserX className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => userAction({ action: "reset-password", userId: user.user_id })}
                        className="rounded-lg px-2 py-1.5 text-amber-600 transition hover:bg-amber-50"
                        title="Reset password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">{search || roleFilter || statusFilter ? "No users match your filters." : "No users found."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              Showing {Math.min(filtered.length, (clippedPage - 1) * pageSize + 1)}–{Math.min(filtered.length, clippedPage * pageSize)} of {filtered.length} users
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Rows
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none">
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <button type="button" disabled={clippedPage <= 1} onClick={() => setPage(clippedPage - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold transition hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="font-semibold text-slate-700">{clippedPage} / {pageCount}</span>
              <button type="button" disabled={clippedPage >= pageCount} onClick={() => setPage(clippedPage + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold transition hover:bg-slate-50 disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Panel>
    </main>
  );
}