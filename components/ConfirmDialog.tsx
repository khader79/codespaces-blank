"use client";

import { AlertTriangle, X } from "lucide-react";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" /></span><div><h2 id="confirm-title" className="text-base font-bold text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{message}</p></div></div><button type="button" onClick={onCancel} aria-label="Close confirmation" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="button" onClick={onConfirm} className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">{confirmLabel}</button></div>
    </div>
  </div>;
}
