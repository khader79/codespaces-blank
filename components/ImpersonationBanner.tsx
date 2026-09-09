"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";

type SessionState = { user: { impersonating?: boolean; tenant_name?: string | null; tenant_id?: number | null } | null };

export default function ImpersonationBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionState["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/auth/session")
      .then((response) => response.json() as Promise<SessionState>)
      .then((data) => setSession(data.user))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [pathname]);

  if (loading || !session?.impersonating || pathname.startsWith("/super-admin")) return null;
  const name = session.tenant_name ?? `Tenant #${session.tenant_id ?? "?"}`;

  async function exitImpersonation() {
    setExiting(true);
    try {
      await fetch("/api/auth/exit-impersonation", { method: "POST" });
    } finally {
      router.replace("/super-admin");
    }
  }

  return (
    <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-amber-300 bg-amber-500 py-1.5 pl-4 pr-1.5 text-sm font-semibold text-white shadow-xl shadow-amber-500/25">
        <span className="inline-flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4" />
          Currently Impersonating {name}
        </span>
        <button
          onClick={exitImpersonation}
          disabled={exiting}
          className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold transition hover:bg-white/30 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}