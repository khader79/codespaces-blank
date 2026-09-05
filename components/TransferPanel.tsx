"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getRecentTransfers,
  getWarehouses,
  type Product,
  type StockTransfer,
  type Warehouse,
} from "@/lib/db";
import { enqueueOp, getCachedWarehouses, listPendingOps, syncPendingOps } from "@/lib/db-offline";
import { STORE_ID } from "@/lib/tenant";
import { useI18n } from "@/lib/i18n";
import ConfirmDialog from "@/components/ConfirmDialog";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
const labelClass = "mb-1 block text-xs font-medium text-gray-500";

export default function TransferPanel({
  storeId = STORE_ID,
  products,
  onChanged,
}: {
  storeId?: number;
  products: Product[];
  onChanged: () => void;
}) {
  const { t } = useI18n();

  const [offline, setOffline] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [warehouseError, setWarehouseError] = useState(false);
  const [transfersError, setTransfersError] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);

  const [productId, setProductId] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [transferConfirmation, setTransferConfirmation] = useState<{ product: string; quantity: number; from: string; to: string } | null>(null);

  function applyWarehouses(rows: Warehouse[]) {
    setWarehouses(rows);
    if (rows.length >= 2) {
      const main = rows.find((w) => w.is_main) ?? rows[0];
      const secondary = rows.find((w) => !w.is_main) ?? rows[1];
      setFromWarehouse(String(main.id));
      setToWarehouse(String(secondary.id));
    } else if (rows.length === 1) {
      setFromWarehouse(String(rows[0].id));
    }
  }

  const refreshWarehouses = useCallback(() => {
    getWarehouses(storeId)
      .then((rows) => {
        applyWarehouses(rows);
        setWarehouseError(false);
      })
      .catch(() => setWarehouseError(true));
  }, [storeId]);

  const refreshTransfers = useCallback(() => {
    getRecentTransfers(storeId)
      .then((rows) => {
        setTransfers(rows);
        setTransfersError(false);
      })
      .catch(() => setTransfersError(true));
  }, [storeId]);

  useEffect(() => {
    async function loadInitial() {
      setWarehouseError(false);
      setTransfersError(false);
      try {
        applyWarehouses(await getWarehouses(storeId));
      } catch {
        setWarehouseError(true);
        const cached = (await getCachedWarehouses(storeId).catch(() => []))
          .map((w) => ({
            id: w.id,
            store_id: storeId,
            name: w.name,
            location: w.location,
            is_main: w.is_main,
          }));
        if (cached.length > 0) {
          applyWarehouses(cached);
          setWarehouseError(false);
        }
      }
      try {
        refreshTransfers();
      } catch {
        setTransfersError(true);
        setTransfers([]);
      }
    }
    loadInitial();
  }, [refreshTransfers, storeId]);

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      refreshWarehouses();
      refreshTransfers();
    };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshTransfers, refreshWarehouses, storeId]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const availableProducts = useMemo(
    () =>
      products.filter(
        (p) => typeof p.stock === "number" && p.stock > 0
      ),
    [products]
  );

  useEffect(() => {
    if (availableProducts.length > 0 && productId === "") {
      setProductId(String(availableProducts[0].id));
    }
  }, [availableProducts, productId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!productId || !fromWarehouse || !toWarehouse || isNaN(qty) || qty <= 0) {
      setMessage({ kind: "error", text: t("transferInvalid") });
      return;
    }
    if (fromWarehouse === toWarehouse) {
      setMessage({ kind: "error", text: t("transferSameWarehouse") });
      return;
    }

    const productName = products.find((product) => product.id === Number(productId))?.name ?? "selected product";
    const fromName = warehouses.find((warehouse) => warehouse.id === Number(fromWarehouse))?.name ?? "source warehouse";
    const toName = warehouses.find((warehouse) => warehouse.id === Number(toWarehouse))?.name ?? "destination warehouse";
    setTransferConfirmation({ product: productName, quantity: qty, from: fromName, to: toName });
  }

  async function confirmTransfer() {
    if (!transferConfirmation) return;
    const qty = parseInt(quantity, 10);
    setTransferConfirmation(null);
    setSubmitting(true);
    setMessage(null);
    try {
      await enqueueOp("transfer", storeId, {
        productId: Number(productId),
        fromWarehouseId: Number(fromWarehouse),
        toWarehouseId: Number(toWarehouse),
        quantity: qty,
        note: note.trim() || null,
      });
      if (navigator.onLine) {
        const result = await syncPendingOps(storeId);
        if (result.rejected.length > 0) {
          setMessage({ kind: "error", text: result.rejected[0].error });
        } else if (result.synced > 0) {
          setMessage({ kind: "success", text: t("transferDone") });
          onChanged();
          refreshTransfers();
        } else {
          setMessage({ kind: "success", text: t("transferQueued") });
        }
      } else {
        setMessage({ kind: "success", text: t("transferQueued") });
      }
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : t("errorPrefix"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = usePendingTransferCount(storeId, offline);

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("transferTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">{t("transferSub")}</p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {t("syncPendingShort", { count: pendingCount })}
          </span>
        )}
      </div>

      {offline && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 13h-4a2 2 0 0 1 0-4h-.32" />
            <path d="M15 13h4a2 2 0 0 0 0-4h-.32" />
            <path d="M12 13v5" />
            <path d="M8 18h8" />
            <path d="m2 2 20 20" />
          </svg>
          {t("transferOffline")}
        </div>
      )}

      {message && (
        <div
          className={`mt-4 mx-6 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {warehouseError && !offline && (
        <p className="mt-2 px-6 text-xs font-medium text-amber-700">
          {t("transferWarehouseError")}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.6fr_1fr_auto]"
      >
        <div>
          <label htmlFor="transfer-product" className={labelClass}>
            {t("transferProduct")}
          </label>
          <select
            id="transfer-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={inputClass}
          >
            {availableProducts.length === 0 && <option value="">—</option>}
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({Number(p.stock) || 0})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="transfer-from" className={labelClass}>
            {t("transferFrom")}
          </label>
          <select
            id="transfer-from"
            value={fromWarehouse}
            onChange={(e) => setFromWarehouse(e.target.value)}
            className={inputClass}
          >
            {warehouses.length === 0 && <option value="">—</option>}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="transfer-to" className={labelClass}>
            {t("transferTo")}
          </label>
          <select
            id="transfer-to"
            value={toWarehouse}
            onChange={(e) => setToWarehouse(e.target.value)}
            className={inputClass}
          >
            {warehouses.length === 0 && <option value="">—</option>}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="transfer-qty" className={labelClass}>
            {t("transferQtyLabel")}
          </label>
          <input
            id="transfer-qty"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="transfer-note" className={labelClass}>
            {t("transferNote")}
          </label>
          <input
            id="transfer-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("transferNotePlaceholder")}
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting || warehouses.length < 2}
            className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("working") : t("transferSubmit")}
          </button>
        </div>
      </form>

      <div className="border-t border-gray-100 px-6 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          {t("transferRecent")}
        </h3>
        {transfersError ? (
          <p className="py-3 text-center text-sm text-amber-600">
            {t("transferListError")}
          </p>
        ) : transfers.length === 0 ? (
          <p className="py-3 text-center text-sm text-gray-400">
            {t("transferEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {transfers.slice(0, 8).map((tr) => (
              <li
                key={tr.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-gray-900">
                  {tr.product?.name ?? `#${tr.product_id}`}
                </span>
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="text-amber-700">
                    {tr.from_warehouse?.name ?? "—"}
                  </span>
                  <svg
                    className="h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                  <span className="text-emerald-700">
                    {tr.to_warehouse?.name ?? "—"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 tabular-nums">
                    {tr.quantity}
                  </span>
                  {tr.note && (
                    <span className="hidden max-w-[220px] truncate text-xs text-gray-400 sm:inline">
                      {tr.note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={transferConfirmation !== null}
        title="Confirm stock transfer"
        message={transferConfirmation ? `Move ${transferConfirmation.quantity} ${transferConfirmation.product} from ${transferConfirmation.from} to ${transferConfirmation.to}?` : ""}
        confirmLabel="Confirm transfer"
        onConfirm={confirmTransfer}
        onCancel={() => setTransferConfirmation(null)}
      />
    </section>
  );
}

function usePendingTransferCount(storeId: number, offline: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    listPendingOps(storeId).then((ops) =>
      setCount(ops.filter((o) => o.kind === "transfer").length)
    );
  }, [storeId, offline]);
  return count;
}