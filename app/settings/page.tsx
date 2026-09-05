"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/ClientAppHeader";
import { getProducts, getSales } from "@/lib/db";
import { STORE_ID } from "@/lib/tenant";
import { useI18n } from "@/lib/i18n";

type Plan = "starter" | "pro";

const DAYS_MS = 1000 * 60 * 60 * 24;

export default function SettingsPage() {
  const { t } = useI18n();
  const [plan, setPlan] = useState<Plan>("starter");
  const [productCount, setProductCount] = useState(0);
  const [transactions, setTransactions] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(STORE_ID), getSales(STORE_ID)])
      .then(([products, sales]) => {
        setProductCount(products.length);
        const cutoff = new Date(Date.now() - 30 * DAYS_MS);
        setTransactions(
          sales.filter((s) => new Date(s.sold_at) >= cutoff).length
        );
      })
      .catch(() => setCheckoutError("Failed to load usage data."));
  }, []);

  const limits = useMemo(
    () => ({
      products: plan === "pro" ? Infinity : 50,
      transactions: plan === "pro" ? Infinity : 500,
      insights: 100,
    }),
    [plan]
  );

  const usageRows = useMemo(
    () => [
      {
        label: t("usageProducts"),
        used: productCount,
        limit: limits.products,
      },
      {
        label: t("usageTransactions"),
        used: transactions,
        limit: limits.transactions,
      },
      {
        label: t("usageInsights"),
        used: 0,
        limit: limits.insights,
      },
    ],
    [t, productCount, transactions, limits]
  );

  async function handleUpgrade() {
    setWorking(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: STORE_ID }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setCheckoutError(json.error ?? t("checkoutError"));
    } catch {
      setCheckoutError(t("checkoutError"));
    } finally {
      setWorking(false);
    }
  }

  const billingUrl = process.env.NEXT_PUBLIC_LS_BILLING_URL;

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t("settingsTitle")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("settingsSub")}</p>
        </header>

        {checkoutError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {checkoutError}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {t("currentPlanLabel")}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PlanCard
              name={t("starterName")}
              price={t("starterPrice")}
              features={[t("featStarter1"), t("featStarter2"), t("featStarter3")]}
              active={plan === "starter"}
              activeLabel={t("planActive")}
              ctaLabel={t("upGrade")}
              onUpgrade={() => setPlan("pro")}
              workingLabel={t("working")}
            />
            <PlanCard
              name={t("proName")}
              price={t("proPrice")}
              features={[t("featPro1"), t("featPro2"), t("featPro3"), t("featPro4")]}
              active={plan === "pro"}
              activeLabel={t("currentPlanLabel")}
              highlighted
              onUpgrade={plan === "pro" ? undefined : handleUpgrade}
              ctaLabel={t("upGrade")}
              ctaWorking={working}
              workingLabel={t("working")}
            />
          </div>
          {plan === "pro" && billingUrl && (
            <a
              href={billingUrl}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              {t("manageBilling")}
            </a>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {t("usageLabel")}
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              {usageRows.map((row) => {
                const pct =
                  row.limit === Infinity
                    ? 100
                    : Math.min(100, Math.round((row.used / row.limit) * 100));
                return (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{row.label}</span>
                      <span className="text-gray-500">
                        {row.used}
                        {row.limit !== Infinity &&
                          ` ${t("ofPlan", { limit: row.limit })}`}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function PlanCard({
  name,
  price,
  features,
  active,
  activeLabel,
  highlighted = false,
  onUpgrade,
  ctaLabel,
  ctaWorking = false,
  workingLabel,
}: {
  name: string;
  price: string;
  features: string[];
  active: boolean;
  activeLabel: string;
  highlighted?: boolean;
  onUpgrade?: () => void;
  ctaLabel: string;
  ctaWorking?: boolean;
  workingLabel: string;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm ${
        highlighted ? "border-blue-400 ring-2 ring-blue-500/20" : "border-gray-200"
      }`}
    >
      {active && (
        <span className="absolute -top-2.5 start-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          {activeLabel}
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold text-gray-900">{name}</h3>
        <span className="text-lg font-semibold text-gray-700">{price}</span>
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm text-gray-600">
            <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${highlighted ? "bg-blue-500" : "bg-gray-300"}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          disabled={ctaWorking}
          className={`mt-6 h-10 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            highlighted
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-700 hover:bg-gray-800"
          }`}
        >
          {ctaWorking ? workingLabel : ctaLabel}
        </button>
      )}
    </div>
  );
}