"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  deleteProduct,
  getProducts,
  getSales,
  insertProduct,
  updateProductStock,
  type Product,
} from "@/lib/db";
import { STORE_ID } from "@/lib/tenant";
import { aggregateMonthly } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import AppHeader from "@/components/ClientAppHeader";
import SalesCharts from "@/components/SalesCharts";
import AnalystPanel from "@/components/AnalystPanel";
import PurchaseOrderPanel from "@/components/PurchaseOrderPanel";
import CopilotDrawer from "@/components/CopilotDrawer";
import AIAlerts from "@/components/AIAlerts";
import TransferPanel from "@/components/TransferPanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoginForm from "@/components/LoginForm";
import { useAuth } from "@/components/AuthProvider";
import { cacheProducts, getCachedProducts } from "@/lib/db-offline";

const LOW_STOCK_THRESHOLD = 5;

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

const labelClass = "mb-1.5 block text-xs font-semibold text-gray-600";

function Dashboard() {
  const storeId = STORE_ID;
  const { t, money } = useI18n();

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getSales>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  useEffect(() => {
    getCachedProducts(storeId, null).then((cached) => {
      if (cached.length > 0) {
        setProducts(cached);
        setLoading(false);
      }
    }).catch(() => undefined);
    Promise.all([getProducts(storeId), getSales(storeId)])
      .then(([p, s]) => {
        setProducts(p);
        setSales(s);
        return cacheProducts(storeId, null, p);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load data.")
      )
      .finally(() => setLoading(false));
  }, [storeId]);

  async function refreshProducts() {
    try {
      const p = await getProducts(storeId);
      setProducts(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh products.");
    }
  }

  const monthly = useMemo(() => aggregateMonthly(sales), [sales]);

  const stats = useMemo(() => {
    const totalStockValue = products.reduce(
      (sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0),
      0
    );
    const lowStockCount = products.filter(
      (p) => (Number(p.stock) || 0) < LOW_STOCK_THRESHOLD
    ).length;
    return { totalStockValue, lowStockCount };
  }, [products]);

  async function handleAddProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);

    if (!name.trim() || isNaN(parsedPrice) || isNaN(parsedStock)) return;

    setSaving(true);
    setError(null);
    try {
      const product = await insertProduct(storeId, {
        name: name.trim(),
        price: parsedPrice,
        stock: parsedStock,
      });
      setProducts((prev) => [...prev, product]);
      setName("");
      setPrice("");
      setStock("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteProduct(storeId, id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await handleDelete(id);
  }

  async function handleAdjustStock(id: number, delta: number) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const newStock = Math.max(0, (Number(product.stock) || 0) + delta);
    try {
      await updateProductStock(storeId, id, newStock);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stock: newStock } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stock.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t("appName")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("dashboardTagline")}</p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("errorPrefix")}: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("statProducts")}
            value={products.length}
            accent="bg-blue-500"
          />
          <StatCard
            label={t("statStockValue")}
            value={money(stats.totalStockValue)}
            accent="bg-emerald-500"
          />
          <StatCard
            label={t("statLowStock")}
            value={stats.lowStockCount}
            accent="bg-amber-500"
          />
        </div>

        <AIAlerts storeId={storeId} />

        <section className="mt-8">
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400 shadow-sm">
              {t("loadingAnalytics")}
            </div>
          ) : (
            <SalesCharts data={monthly} />
          )}
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Plus className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-gray-900">
                {t("formAddProduct")}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{t("formAddSub")}</p>
            <form
              onSubmit={handleAddProduct}
              className="mt-4 flex flex-1 flex-col gap-3"
            >
              <div>
                <label htmlFor="new-name" className={labelClass}>
                  {t("formName")}
                </label>
                <input
                  id="new-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wireless Mouse"
                  className={inputClass}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="new-price" className={labelClass}>
                    {t("formPrice")}
                  </label>
                  <input
                    id="new-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="new-stock" className={labelClass}>
                    {t("formStock")}
                  </label>
                  <input
                    id="new-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {saving ? t("formAdding") : t("formAdd")}
              </button>
            </form>
          </div>

          <AnalystPanel storeId={storeId} />

          <PurchaseOrderPanel products={products} />
        </section>

        <TransferPanel storeId={storeId} products={products} onChanged={refreshProducts} />

        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("tableProducts")}
            </h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {t("tableInCatalog", { count: products.length })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {(
                    [
                      "thProduct",
                      "thPrice",
                      "thStock",
                      "thStatus",
                      "thValue",
                      "thActions",
                    ] as const
                  ).map((key) => (
                    <th
                      key={key}
                      className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${
                        key === "thValue" || key === "thActions"
                          ? "text-right"
                          : ""
                      }`}
                    >
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      {t("loadingProducts")}
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      {t("noProducts")}
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const pStock = Number(product.stock) || 0;
                    const pPrice = Number(product.price) || 0;
                    return (
                      <tr
                        key={product.id}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {product.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                          {money(pPrice)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-center text-sm tabular-nums text-gray-700">
                          {pStock}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <StockBadge stock={pStock} />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm tabular-nums text-gray-700">
                          {money(pPrice * pStock)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <IconButton
                              onClick={() => handleAdjustStock(product.id, -1)}
                              disabled={pStock <= 0}
                              label={t("statusLow")}
                            >
                              &#8722;
                            </IconButton>
                            <IconButton
                              onClick={() => handleAdjustStock(product.id, 1)}
                              label="+"
                            >
                              +
                            </IconButton>
                            <IconButton
                              onClick={() => setDeleteTarget(product)}
                              label="Delete"
                              danger
                            >
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setCopilotOpen(true)}
        className="fixed bottom-6 end-6 z-30 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
          AI
        </span>
        {t("aiCopilot")}
      </button>

      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        storeId={storeId}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this product?"
        message={deleteTarget ? `${deleteTarget.name} will be removed from the catalog. This action cannot be undone.` : ""}
        confirmLabel="Delete product"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

export default function Home() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <LoginForm />;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  const { t } = useI18n();
  if (stock === 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        {t("statusOut")}
      </span>
    );
  }
  if (stock < LOW_STOCK_THRESHOLD) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        {t("statusLow")}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      {t("statusIn")}
    </span>
  );
}

function IconButton({
  onClick,
  children,
  label,
  danger = false,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}