"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/ClientAppHeader";
import { useI18n } from "@/lib/i18n";
import { STORE_ID } from "@/lib/tenant";

type FinanceSummary = {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  invoiced: number;
  cashCollected: number;
  receivables: number;
  invoiceCount: number;
};

const emptySummary: FinanceSummary = {
  revenue: 0,
  costOfGoodsSold: 0,
  grossProfit: 0,
  invoiced: 0,
  cashCollected: 0,
  receivables: 0,
  invoiceCount: 0,
};

export default function FinancePage() {
  const { money } = useI18n();
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/finance/summary?storeId=${STORE_ID}`)
      .then(async (response) => {
        const body = (await response.json()) as FinanceSummary & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load financial summary.");
        setSummary(body);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load financial summary."))
      .finally(() => setLoading(false));
  }, []);

  const metrics = [
    { label: "Revenue", value: summary.revenue, tone: "text-emerald-700" },
    { label: "Gross profit", value: summary.grossProfit, tone: "text-blue-700" },
    { label: "Cash collected", value: summary.cashCollected, tone: "text-slate-900" },
    { label: "Accounts receivable", value: summary.receivables, tone: "text-amber-700" },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Finance control center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Financial overview</h1>
            <p className="mt-1 text-sm text-slate-500">Double-entry-ready reporting for sales, cash, and customer credit.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{summary.invoiceCount} invoices</div>
        </header>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Financial metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{metric.label}</p>
              {loading ? <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-100" /> : <p className={`mt-3 text-2xl font-bold tabular-nums ${metric.tone}`}>{money(metric.value)}</p>}
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Profit and loss snapshot</h2>
            <div className="mt-6 space-y-5">
              <ReportRow label="Sales revenue" value={summary.revenue} money={money} positive />
              <ReportRow label="Cost of goods sold" value={summary.costOfGoodsSold} money={money} />
              <div className="border-t border-slate-100 pt-4"><ReportRow label="Gross profit" value={summary.grossProfit} money={money} positive /></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Ledger foundation</p>
            <h2 className="mt-3 text-xl font-semibold">Chart of accounts is ready</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Assets, liabilities, equity, revenue, and expenses are available for journalized invoice, payment, sale, return, and stock activity.</p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-slate-300"><span className="rounded border border-slate-700 px-3 py-2">Cash & A/R</span><span className="rounded border border-slate-700 px-3 py-2">Inventory</span><span className="rounded border border-slate-700 px-3 py-2">Revenue</span><span className="rounded border border-slate-700 px-3 py-2">COGS</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportRow({ label, value, money, positive = false }: { label: string; value: number; money: (value: number) => string; positive?: boolean }) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-600">{label}</span><span className={`font-semibold tabular-nums ${positive ? "text-emerald-700" : "text-slate-900"}`}>{money(value)}</span></div>;
}
