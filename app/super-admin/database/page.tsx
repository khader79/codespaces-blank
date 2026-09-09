"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Database, Download, Pencil, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/super-admin";

const TABLES = [
  "tenants", "tenant_users", "stores", "warehouses", "products", "invoices", "invoice_lines",
  "sales", "customers", "payments", "returns", "return_lines", "inventory", "inventory_stock",
  "stock_ledger", "stock_transfers", "journal_entries", "journal_lines", "chart_of_accounts",
  "audit_logs", "system_audit_logs", "platform_plans", "platform_settings", "tenant_promotions",
  "activation_vouchers", "entities", "inventory_lots", "product_bom_lines", "inventory_cost_layers",
  "financial_account_balances", "ai_recommendations",
] as const;

const AUTO_COLUMNS = ["id", "created_at", "updated_at"];

type Row = Record<string, unknown>;

function coerceValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  return str.length > 120 ? str.slice(0, 120) + "…" : str;
}

function inputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function SuperAdminDatabasePage() {
  const [activeTable, setActiveTable] = useState<(typeof TABLES)[number]>("tenants");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function loadTable(table: (typeof TABLES)[number]) {
    setLoading(true);
    setError("");
    setMessage("");
    setEditingId(null);
    setPage(1);
    const response = await fetch(`/api/super-admin/tables?table=${table}&limit=1000`, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { error?: string; rows?: Row[] };
    if (!response.ok) setError(body.error ?? "Failed to load table.");
    else setRows(body.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTable(activeTable);
  }, [activeTable]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) Object.keys(row).forEach((k) => keys.add(k));
    return Array.from(keys);
  }, [rows]);

  const editableColumns = columns.filter((column) => !AUTO_COLUMNS.includes(column) && !["password_hash", "pin_hash"].includes(column));

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const haystack = Object.values(row).map(displayValue).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clippedPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((clippedPage - 1) * pageSize, clippedPage * pageSize);

  function dismissAlerts() {
    setError("");
    setMessage("");
  }

  function startEdit(row: Row) {
    const id = row.id;
    if (id === undefined) return;
    setEditingId(String(id));
    setDraft(Object.fromEntries(editableColumns.map((column) => [column, inputValue(row[column])])));
    dismissAlerts();
  }

  async function saveEdit(row: Row) {
    const id = row.id;
    if (id === undefined) return;
    setSaving(true);
    setError("");
    setMessage("");
    const values: Record<string, unknown> = {};
    for (const column of editableColumns) {
      const original = row[column];
      const next = coerceValue(draft[column] ?? "");
      if (JSON.stringify(original) !== JSON.stringify(next)) values[column] = next;
    }
    const response = await fetch("/api/super-admin/tables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: activeTable, id, values }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (response.ok) {
      setMessage(`Row ${String(id)} updated in ${activeTable}.`);
      setEditingId(null);
      await loadTable(activeTable);
    } else {
      setError(body.error ?? "Update failed.");
    }
  }

  async function deleteRow(id: string | number) {
    if (!window.confirm(`Permanently delete row ${String(id)} from ${activeTable}?`)) return;
    dismissAlerts();
    setSaving(true);
    const response = await fetch("/api/super-admin/tables", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: activeTable, id }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (response.ok) {
      setMessage(`Row ${String(id)} deleted from ${activeTable}.`);
      await loadTable(activeTable);
    } else {
      setError(body.error ?? "Delete failed.");
    }
  }

  function exportCsv() {
    if (filteredRows.length === 0) return;
    const header = columns.join(",");
    const lines = filteredRows.map((row) =>
      columns
        .map((column) => {
          const value = row[column];
          if (value === null || value === undefined) return "";
          const str = typeof value === "object" ? JSON.stringify(value) : String(value);
          return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
        })
        .join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeTable}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
      <PageHeader
        eyebrow="Data"
        title="Database Inspector"
        description="Service-role access to every platform table. Edits and deletes are audited and bound to 1,000 rows per load."
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => loadTable(activeTable)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </>
        }
      />

      {(error || message) && (
        <div className={`mt-5 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          <span className="font-semibold">{error || message}</span>
          <button type="button" onClick={dismissAlerts} aria-label="Dismiss">
            <X className="h-4 w-4 opacity-60" />
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex h-10 max-w-xs flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400">
          <Database className="h-4 w-4 shrink-0" />
          <select
            value={activeTable}
            onChange={(e) => setActiveTable(e.target.value as (typeof TABLES)[number])}
            className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-semibold text-slate-800 outline-none"
          >
            {TABLES.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Search ${activeTable}...`}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
          />
        </label>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-md border border-slate-200 bg-white px-3 py-2">
            {columns.length} columns
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-2">
            {filteredRows.length} rows
          </span>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">Loading table data...</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">No rows in {activeTable}.</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap border-b border-slate-200 px-4 py-3">
                      {column}
                      {AUTO_COLUMNS.includes(column) && <span className="ml-1 text-slate-300">•</span>}
                    </th>
                  ))}
                  <th className="sticky right-0 border-b border-slate-200 bg-slate-50 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => {
                  const id = String(row.id);
                  const isEditing = editingId === id;
                  return (
                    <tr key={id} className="hover:bg-slate-50/70">
                      {columns.map((column) => {
                        const value = row[column];
                        const auto = AUTO_COLUMNS.includes(column);
                        if (isEditing && !auto) {
                          const editingValue = draft[column] ?? "";
                          const changed = JSON.stringify(value) !== JSON.stringify(coerceValue(editingValue));
                          return (
                            <td key={column} className="max-w-[280px] px-4 py-2">
                              <input
                                value={editingValue}
                                onChange={(e) => setDraft((previous) => ({ ...previous, [column]: e.target.value }))}
                                className={`h-8 w-full rounded-md border px-2 font-mono text-xs outline-none focus:border-blue-500 ${
                                  changed ? "border-amber-300 bg-amber-50" : "border-slate-200"
                                }`}
                              />
                            </td>
                          );
                        }
                        return (
                          <td key={column} className="max-w-[280px] truncate whitespace-nowrap px-4 py-3 align-top text-slate-600" title={displayValue(value)}>
                            <span className="font-mono text-xs">{displayValue(value)}</span>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 bg-white px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => saveEdit(row)}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => deleteRow(id === "undefined" ? "" : id)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && filteredRows.length === 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                      No rows in {activeTable} match your search.
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {filteredRows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              Showing {Math.min(filteredRows.length, (clippedPage - 1) * pageSize + 1)}–{Math.min(filteredRows.length, clippedPage * pageSize)} of {filteredRows.length} rows
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={clippedPage <= 1}
                onClick={() => setPage(clippedPage - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="font-semibold text-slate-700">
                {clippedPage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={clippedPage >= pageCount}
                onClick={() => setPage(clippedPage + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <Save className="h-3.5 w-3.5" />
        Sensitive columns are locked server-side. Auto columns ({AUTO_COLUMNS.join(", ")}) are read-only. All mutations are recorded in system_audit_logs.
      </p>
    </main>
  );
}