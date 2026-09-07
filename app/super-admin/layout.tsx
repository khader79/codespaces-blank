"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, Building2, Database, FileText, LayoutDashboard, LogOut, Search, ShieldCheck, Users } from "lucide-react";

const links = [
  ["Overview", "/super-admin", LayoutDashboard],
  ["Workspaces / Companies", "/super-admin/tenants", Building2],
  ["All Users", "/super-admin/users", Users],
  ["Database Tables", "/super-admin/database", Database],
  ["Audit Logs", "/super-admin/logs", FileText],
] as const;

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() { setLoggingOut(true); await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }
  return <div className="min-h-screen bg-[#f4f6f8] text-slate-900 lg:flex"><aside className="flex w-full shrink-0 flex-col bg-[#111827] text-white lg:fixed lg:inset-y-0 lg:w-72"><div className="flex h-20 items-center gap-3 border-b border-white/10 px-7"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/20"><ShieldCheck className="h-5 w-5" /></span><div><p className="font-bold tracking-tight">StoreFlow</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Platform Control</p></div></div><div className="mx-6 mt-6 flex items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-xs font-bold text-blue-200"><Activity className="h-4 w-4" />Super Admin</div><nav className="flex gap-1 overflow-x-auto px-4 py-6 lg:block lg:flex-1 lg:space-y-1">{links.map(([label, href, Icon]) => <Link key={href} href={href} className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${pathname === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</Link>)}</nav><div className="hidden border-t border-white/10 p-6 lg:block"><p className="text-xs font-semibold text-emerald-300">System operational</p><p className="mt-1 text-xs text-slate-500">Privileged platform session</p></div></aside><div className="min-w-0 flex-1 lg:ms-72"><header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-5 backdrop-blur-xl sm:px-8"><label className="flex h-10 max-w-xl flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"><Search className="h-4 w-4" /><input placeholder="Search platform..." className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" /></label><div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs font-bold text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Operational</span><button type="button" onClick={logout} disabled={loggingOut} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><LogOut className="h-4 w-4" />Logout</button></div></header><main>{children}</main></div></div>;
}