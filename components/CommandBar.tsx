"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Command, Search, ArrowRight, Package, ReceiptText, Users } from "lucide-react";
import { getProducts, type Product } from "@/lib/db";
import { STORE_ID } from "@/lib/tenant";

type CommandItem = { href: string; label: string; detail: string; icon: typeof Package };

export default function CommandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    getProducts(STORE_ID).then(setProducts).catch(() => setProducts([]));
  }, [open]);

  const q = query.trim().toLowerCase();
  const items: CommandItem[] = [
    { href: "/", label: "Dashboard", detail: "Overview and operations", icon: Command },
    { href: "/pos", label: "POS / Terminal", detail: "Open a new sale", icon: ReceiptText },
    { href: "/finance", label: "Finance", detail: "P&L and receivables", icon: ReceiptText },
    { href: "/settings", label: "Settings", detail: "Workspace configuration", icon: Users },
    ...products.filter((product) => product.name.toLowerCase().includes(q)).slice(0, 5).map((product) => ({
      href: "/?product=" + product.id,
      label: product.name,
      detail: `Catalog product · ${product.stock} in stock`,
      icon: Package,
    })),
  ];
  const filtered = q ? items.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(q)) : items;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center gap-3 rounded-lg border border-slate-200/80 bg-white/70 px-0 text-left text-sm text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-600 md:w-auto md:min-w-64 md:justify-start md:px-3" aria-label="Open command search">
        <Search className="h-4 w-4" /><span className="hidden flex-1 md:block">Search anything...</span><kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 md:block">⌘ K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/30 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4"><Search className="h-5 w-5 text-slate-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, invoices, customers..." className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" /><kbd className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-400">ESC</kbd></div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filtered.length === 0 ? <p className="px-3 py-10 text-center text-sm text-slate-500">No matching records found.</p> : filtered.map((item) => { const Icon = item.icon; return <Link key={`${item.href}-${item.label}`} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-slate-50"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{item.label}</span><span className="block truncate text-xs text-slate-400">{item.detail}</span></span><ArrowRight className="h-4 w-4 text-slate-300" /></Link>; })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
