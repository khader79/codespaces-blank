"use client";

import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

type Tenant = { id: number; name: string; status: "active" | "suspended"; created_at: string; subscription_expires_at: string; user_count: number };

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [months, setMonths] = useState("1");
  const [voucher, setVoucher] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError(null);
    const response = await fetch("/api/admin", { headers: { "x-storeflow-admin-key": key } });
    const body = await response.json() as { tenants?: Tenant[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Unable to load admin data.");
    setTenants(body.tenants ?? []);
    setLoaded(true);
  }
  useEffect(() => { const saved = window.sessionStorage.getItem("storeflow-admin-key"); if (saved) { setKey(saved); } }, []);

  async function update(tenant: Tenant, status: Tenant["status"], extensionMonths = 0) {
    const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json", "x-storeflow-admin-key": key }, body: JSON.stringify({ tenantId: tenant.id, status, months: extensionMonths }) });
    if (!response.ok) { const body = await response.json() as { error?: string }; setError(body.error ?? "Update failed."); return; }
    await load();
  }
  async function generateVoucher() {
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", "x-storeflow-admin-key": key }, body: JSON.stringify({ months: Number(months) }) });
    const body = await response.json() as { code?: string; error?: string };
    if (!response.ok) { setError(body.error ?? "Voucher generation failed."); return; }
    setVoucher(body.code ?? null);
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600"><ShieldCheck className="h-4 w-4" />System administration</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Tenant control center</h1><p className="mt-1 text-sm text-slate-500">Manage company access, trial periods, and activation vouchers.</p></div>{loaded && <button type="button" onClick={() => load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to refresh."))} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button>}</header>
    {!loaded ? <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-950">Restricted access</h2><p className="mt-2 text-sm leading-6 text-slate-500">Enter the system administrator key to open tenant controls. This key is checked only on the server.</p><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="System admin key" className="mt-5 h-12 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" /><button type="button" onClick={() => { window.sessionStorage.setItem("storeflow-admin-key", key); load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load admin data.")); }} className="mt-3 h-12 w-full rounded-lg bg-slate-950 text-sm font-bold text-white hover:bg-slate-800">Open admin panel</button>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}</section> : <><section className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><KeyRound className="h-4 w-4 text-blue-600" />Generate activation voucher</h2><p className="mt-1 text-sm text-slate-600">Create a one-time code that adds months to a new trial.</p></div><div className="flex gap-2"><input type="number" min="1" max="120" value={months} onChange={(e) => setMonths(e.target.value)} className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={generateVoucher} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">Generate</button></div></div>{voucher && <p className="mt-4 rounded-lg bg-white px-4 py-3 font-mono text-sm font-bold tracking-wider text-blue-700">{voucher}</p>}</section><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-950">Registered companies</h2></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Company</th><th className="px-5 py-3">Users</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{tenants.map((tenant) => <tr key={tenant.id}><td className="px-5 py-4 font-semibold text-slate-900">{tenant.name}</td><td className="px-5 py-4 text-slate-600">{tenant.user_count}</td><td className="px-5 py-4 text-slate-600">{new Date(tenant.created_at).toLocaleDateString()}</td><td className="px-5 py-4 text-slate-600">{new Date(tenant.subscription_expires_at).toLocaleDateString()}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tenant.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{tenant.status}</span></td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => update(tenant, tenant.status === "active" ? "suspended" : "active")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{tenant.status === "active" ? "Suspend" : "Activate"}</button><button type="button" onClick={() => update(tenant, tenant.status, 1)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">+1 month</button></div></td></tr>)}</tbody></table></div>{tenants.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No tenants registered yet.</p>}</section></>}</div></main>;
}
