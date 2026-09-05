"use client";

import { useState } from "react";
import { CircleHelp, X } from "lucide-react";

export default function UserGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white" aria-label="Open StoreFlow user guide">
        <CircleHelp className="h-4 w-4 text-blue-600" />
        <span className="hidden lg:inline">طريقة الاستخدام / User Guide</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="guide-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">StoreFlow</p><h2 id="guide-title" className="mt-2 text-xl font-bold text-slate-950">طريقة الاستخدام / User Guide</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close user guide" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2"><GuideStep number="01" title="Choose a workspace" text="Use the left sidebar to move between operations, inventory, finance, and analytics." /><GuideStep number="02" title="Search quickly" text="Press Ctrl+K or Cmd+K to find products and open common workflows." /><GuideStep number="03" title="Work offline" text="POS sales, transfers, and invoice drafts queue locally and sync when connection returns." /><GuideStep number="04" title="Review before saving" text="Check warehouse, quantity, tax, and customer credit before confirming important changes." /></div>
          </section>
        </div>
      )}
    </>
  );
}

function GuideStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-4"><span className="text-xs font-bold text-blue-600">{number}</span><h3 className="mt-2 text-sm font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>;
}
