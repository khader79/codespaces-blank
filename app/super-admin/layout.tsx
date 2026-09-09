"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Building2,
  Command,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import MaintenanceToggle from "@/components/MaintenanceToggle";

type NavItem = readonly [label: string, href: string, Icon: typeof LayoutDashboard, keywords: string];

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Platform",
    items: [["Overview", "/super-admin", LayoutDashboard, "dashboard home"] as NavItem],
  },
  {
    label: "Management",
    items: [
      ["Companies", "/super-admin/tenants", Building2, "workspaces tenants companies"] as NavItem,
      ["Users", "/super-admin/users", Users, "members identities roles"] as NavItem,
    ],
  },
  {
    label: "Data & Audit",
    items: [
      ["Database", "/super-admin/database", Database, "tables rows inspector data"] as NavItem,
      ["Audit Logs", "/super-admin/logs", FileText, "activity history trail"] as NavItem,
    ],
  },
  {
    label: "System",
    items: [["Settings", "/super-admin/settings", Settings2, "config plans maintenance cache"] as NavItem],
  },
];

const flatPages = groups.flatMap((group) => group.items);

function CommandSearch({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "SELECT") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = flatPages.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item[0]} ${item[3]}`.toLowerCase().includes(needle);
  });

  return (
    <div className="relative flex-1">
      <label className="flex h-10 w-full max-w-xl items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
        <Search className="h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder="Search the command center..."
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-400 sm:flex">
          <Command className="h-3 w-3" />K
        </kbd>
      </label>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
          {results.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-400">No matching pages.</div>}
          {results.map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon className="h-4 w-4" />
              </span>
              {label}
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-300">{href}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip() {
  const [maintenance, setMaintenance] = useState(false);
  useEffect(() => {
    fetch("/api/super-admin/infrastructure")
      .then((response) => response.json() as Promise<{ maintenance?: boolean }>)
      .then((data) => setMaintenance(Boolean(data.maintenance)))
      .catch(() => undefined);
  }, []);
  return maintenance ? (
    <span className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 sm:inline-flex">
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />Maintenance mode
    </span>
  ) : (
    <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:inline-flex">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />Operational
    </span>
  );
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function isActive(href: string) {
    if (href === "/super-admin") return pathname === "/super-admin";
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-[#eef1f5] text-slate-900 lg:flex">
      <aside className="flex w-full shrink-0 flex-col bg-[#0b1220] text-white lg:fixed lg:inset-y-0 lg:w-72">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold tracking-tight">StoreFlow</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Platform Control</p>
          </div>
        </div>

        <div className="mx-6 mt-6 flex items-center gap-2 rounded-xl border border-blue-400/20 bg-gradient-to-r from-blue-500/15 to-violet-500/10 px-3 py-2.5 text-xs font-bold text-blue-200">
          <Activity className="h-4 w-4" />
          Super Admin
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {groups.map((group) => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(([label, href, Icon]) => (
                  <Link
                    key={href}
                    href={href}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                      isActive(href) ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {isActive(href) && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-400 shadow-[0_0_10px_2px_rgba(96,165,250,0.5)]" />}
                    <Icon className={`h-4 w-4 ${isActive(href) ? "text-blue-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                    {label}
                    {isActive(href) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-white/10 p-6 lg:block">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
            System operational
          </div>
          <p className="mt-1 text-xs text-slate-500">Privileged platform session</p>
          <p className="mt-4 rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[10px] text-slate-500">storeflow v1.0.0</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ms-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-5 backdrop-blur-xl sm:px-8">
          <CommandSearch onNavigate={() => undefined} />
          <div className="flex items-center gap-3">
            <StatusChip />
            <MaintenanceToggle />
            <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white sm:flex" title="Super Admin" aria-hidden>
              SA
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-5rem)]">{children}</main>
      </div>
    </div>
  );
}