"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

export default function MaintenanceToggle() {
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/super-admin/infrastructure")
      .then((response) => response.json() as Promise<{ maintenance?: boolean }>)
      .then((data) => setMaintenance(Boolean(data.maintenance)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/super-admin/infrastructure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "maintenance", enabled: !maintenance }),
      });
      const data = (await response.json()) as { maintenance?: boolean };
      if (response.ok) setMaintenance(Boolean(data.maintenance));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || busy}
      title={maintenance ? "Maintenance mode is ON — tenant traffic is redirected to /maintenance" : "Turn on global maintenance mode"}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
        maintenance ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Wrench className={`h-4 w-4 ${maintenance ? "animate-pulse" : ""}`} />
      <span className="hidden sm:inline">{loading ? "Checking..." : maintenance ? "Maintenance ON" : "Maintenance"}</span>
      <span className={`relative ml-1 inline-block h-4 w-7 rounded-full transition ${maintenance ? "bg-amber-500" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${maintenance ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}