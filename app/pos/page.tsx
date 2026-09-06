"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/ClientAppHeader";
import { getProducts, getWarehouseInventory, getWarehouses } from "@/lib/db";
import {
  cacheProducts,
  cacheWarehouses,
  enqueueOp,
  getCachedProducts,
  getCachedWarehouses,
  listPendingOps,
  newClientOpId,
  patchCachedStockById,
  syncPendingOps,
  type CachedProduct,
  type PendingOp,
} from "@/lib/db-offline";
import { STORE_ID } from "@/lib/tenant";
import { useI18n } from "@/lib/i18n";

interface CartLine {
  product: CachedProduct;
  qty: number;
}

type Flash = { kind: "error" | "success"; text: string } | null;

const SYNC_INTERVAL_MS = 10000;

export default function PosPage() {
  const { t, money } = useI18n();
  const storeId = STORE_ID;

  const [warehouses, setWarehouses] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [activeWarehouse, setActiveWarehouse] = useState<number | null>(null);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [pending, setPending] = useState<PendingOp[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const activeWarehouseRef = useRef<number | null>(null);

  function setActiveWarehouseBoth(next: number | null) {
    activeWarehouseRef.current = next;
    setActiveWarehouse(next);
  }

  const refreshPending = useCallback(async () => {
    setPending(await listPendingOps(storeId));
  }, [storeId]);

  const loadProducts = useCallback(
    async (warehouseId: number | null) => {
      const cached = await getCachedProducts(storeId, warehouseId).catch(
        () => [] as CachedProduct[]
      );
      if (cached.length > 0) {
        setProducts(cached);
        setLoading(false);
      }
      try {
        const server = await getProducts(storeId);
        let overlaid = server;
        if (warehouseId !== null) {
          try {
            const inventory = await getWarehouseInventory(warehouseId);
            overlaid = server.map((p) => ({
              ...p,
              stock: inventory.get(p.id) ?? (Number(p.stock) || 0),
            }));
          } catch {
            /* inventory table unavailable; keep products.stock */
          }
        }
        await cacheProducts(storeId, warehouseId, overlaid);
        setProducts(await getCachedProducts(storeId, warehouseId));
      } catch {
        if (cached.length === 0) setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [storeId]
  );

  const loadWarehouses = useCallback(async () => {
    try {
      const rows = await getWarehouses(storeId);
      await cacheWarehouses(rows);
      setWarehouses(rows);
      const main = rows.find((w) => w.is_main) ?? rows[0] ?? null;
      const current = activeWarehouseRef.current;
      if (current === null && main) {
        setActiveWarehouseBoth(main.id);
      } else if (current !== null && !rows.some((w) => w.id === current)) {
        setActiveWarehouseBoth(main ? main.id : null);
      }
    } catch {
      const cached = await getCachedWarehouses(storeId).catch(
        () => [] as Awaited<ReturnType<typeof getCachedWarehouses>>
      );
      setWarehouses(cached);
    }
    await refreshPending();
  }, [storeId, refreshPending]);

  const syncQueue = useCallback(async () => {
    const result = await syncPendingOps(storeId);
    for (const rej of result.rejected) {
      setFlash({
        kind: "error",
        text: t("syncRejected", { kind: rej.kind, error: rej.error }),
      });
    }
    if (result.synced > 0) {
      await loadProducts(activeWarehouseRef.current);
    }
    await refreshPending();
    return result;
  }, [loadProducts, refreshPending, storeId, t]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = async () => {
      setOnline(true);
      await loadWarehouses();
      await syncQueue();
      await loadProducts(activeWarehouseRef.current);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadProducts, loadWarehouses, syncQueue]);

  useEffect(() => {
    loadWarehouses();

    const interval = setInterval(() => {
      if (navigator.onLine) {
        listPendingOps(storeId).then((ops) => {
          if (ops.length > 0) syncQueue();
        });
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadWarehouses, syncQueue, storeId]);

  useEffect(() => {
    if (activeWarehouse === null) return;
    loadProducts(activeWarehouse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWarehouse]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);

  const shownProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const accessible = online || products.length > 0;

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, line) => sum + (line.product.price || 0) * line.qty, 0),
    [cart]
  );

  function addToCart(product: CachedProduct) {
    const inCart = cart.find((l) => l.product.id === product.id)?.qty ?? 0;
    if (product.stock - inCart <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function changeQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const next = l.qty + delta;
          if (next > l.product.stock) return l;
          return { ...l, qty: next };
        })
        .filter((l) => l.qty > 0)
    );
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const match = shownProducts[0];
    if (match) {
      addToCart(match);
    } else {
      setFlash({ kind: "error", text: t("posNoMatch", { query: search }) });
    }
    setSearch("");
  }

  function handleWarehouseChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setActiveWarehouseBoth(Number(e.target.value));
  }

  async function completeSale() {
    if (cart.length === 0 || activeWarehouse === null) return;
    setBusy(true);
    const clientOpId = newClientOpId();
    const items = cart.map((l) => ({
      product_id: l.product.id,
      quantity: l.qty,
    }));
    const total = money(subtotal);

    try {
      if (navigator.onLine) {
        try {
          const res = await fetch("/api/pos/sale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId,
              warehouseId: activeWarehouse,
              clientOpId,
              items,
            }),
          });
          if (res.ok) {
            setFlash({ kind: "success", text: t("posSuccess", { total }) });
            setCart([]);
            await loadProducts(activeWarehouse);
            searchRef.current?.focus();
            return;
          }
        } catch {
          /* fall through to the offline queue below */
        }
      }

      await enqueueOp("sale", storeId, {
        warehouseId: activeWarehouse,
        items,
      });
      for (const line of cart) {
        await patchCachedStockById(line.product.id, activeWarehouse, line.qty);
      }
      setCart([]);
      setProducts(await getCachedProducts(storeId, activeWarehouse));
      await refreshPending();

      if (navigator.onLine) {
        const result = await syncPendingOps(storeId);
        if (result.synced > 0) {
          await loadProducts(activeWarehouse);
          await refreshPending();
          setFlash({ kind: "success", text: t("posSuccess", { total }) });
        } else if (result.failed > 0) {
          setFlash({ kind: "success", text: t("posQueued") });
        } else {
          setFlash({ kind: "success", text: t("posQueued") });
        }
      } else {
        setFlash({ kind: "success", text: t("posQueued") });
      }
      searchRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = pending.length;

  return (
    <main className="min-h-screen bg-gray-50">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t("posTitle")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("posSub")}</p>
        </header>

        {flash && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              flash.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {flash.text}
          </div>
        )}

        {!online && products.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>{t("offlineBanner")}</strong> {t("offlineNotice")}
          </div>
        )}
        {!online && products.length === 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("offlineUnavailable")}
          </div>
        )}
        {pendingCount > 0 && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {t("syncPending", {
              count: pendingCount,
              state: online ? t("posSyncing") : t("offlineMode"),
            })}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="pos-warehouse" className="text-sm font-medium text-gray-600">
            {t("posWarehouse")}
          </label>
          <select
            id="pos-warehouse"
            value={activeWarehouse ?? ""}
            onChange={handleWarehouseChange}
            disabled={warehouses.length === 0}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {warehouses.length === 0 && (
              <option value="">{t("loadingProducts")}</option>
            )}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <StatusPill online={online} pendingCount={pendingCount} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <section>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                disabled={!accessible}
                placeholder={t("posSearch")}
                aria-label={t("posSearch")}
                className="w-full rounded-lg border border-blue-300 bg-blue-50/40 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-gray-400">{t("posSearchHint")}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {loading ? (
                <div className="col-span-full py-12 text-center text-sm text-gray-400">
                  {t("loadingProducts")}
                </div>
              ) : !accessible ? (
                <div className="col-span-full py-12 text-center text-sm text-gray-400">
                  {t("offlineUnavailable")}
                </div>
              ) : shownProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-sm text-gray-400">
                  {t("posNoMatch", { query: search })}
                </div>
              ) : (
                shownProducts.map((product) => {
                  const pStock = product.stock || 0;
                  const inCart =
                    cart.find((l) => l.product.id === product.id)?.qty ?? 0;
                  const available = pStock - inCart;
                  const soldOut = available <= 0;
                  return (
                    <button
                      key={`${activeWarehouse}-${product.id}`}
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={soldOut}
                      className={`relative flex flex-col rounded-xl border p-4 text-start shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        soldOut
                          ? "border-gray-200 bg-gray-50"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow"
                      }`}
                    >
                      {inCart > 0 ? (
                        <span className="absolute -top-2 -end-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
                          {inCart}
                        </span>
                      ) : null}
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm font-medium text-blue-700">
                        {money(product.price)}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          pStock === 0
                            ? "text-red-600"
                            : pStock < 5
                              ? "text-amber-600"
                              : "text-gray-400"
                        }`}
                      >
                        {pStock === 0
                          ? t("statusOut")
                          : `${pStock} ${pStock === 1 ? t("posQty") : t("posItems")}`}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                {t("posCart")}
              </h2>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {cart.length}
              </span>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  {t("posEmptyCart")}
                </p>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.product.id}
                    className="flex items-center justify-between gap-2 border-b border-gray-100 py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {line.product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {money(line.product.price)} &times; {line.qty}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => changeQty(line.product.id, -1)}
                        className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
                        aria-label="-"
                      >
                        &#8722;
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(line.product.id, 1)}
                        className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50"
                        aria-label="+"
                      >
                        +
                      </button>
                      <span className="w-20 text-end text-sm font-semibold tabular-nums text-gray-900">
                        {money(line.product.price * line.qty)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-200 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{t("posSubtotal")}</span>
                <span className="text-lg font-bold text-gray-900">
                  {money(subtotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={completeSale}
                disabled={cart.length === 0 || busy || activeWarehouse === null}
                className="w-full rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("posPaying") : t("posPay")}
              </button>
              {!online && pendingCount > 0 && (
                <p className="mt-2 text-center text-xs text-amber-600">
                  {t("posQueuedHint")}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusPill({
  online,
  pendingCount,
}: {
  online: boolean;
  pendingCount: number;
}) {
  const { t } = useI18n();
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        {t("offlineMode")}
        {pendingCount > 0 ? " · " + t("syncPendingShort", { count: pendingCount }) : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {t("posOnline")}
    </span>
  );
}