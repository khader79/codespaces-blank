"use client";

import { FileDown, FileSpreadsheet, Printer, ReceiptText } from "lucide-react";
import { downloadA4Pdf, downloadRows, printThermalReceipt, type ExportRow } from "@/lib/data-export";

export default function ExportActions({ title, rows, receipt = false }: { title: string; rows: ExportRow[]; receipt?: boolean }) {
  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => downloadRows(`${title.toLowerCase().replace(/\s+/g, "-")}.csv`, rows)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileDown className="h-4 w-4" />CSV</button>
    <button type="button" onClick={() => downloadRows(`${title.toLowerCase().replace(/\s+/g, "-")}.xls`, rows, true)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4" />Excel</button>
    <button type="button" onClick={() => downloadA4Pdf(title, rows)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileDown className="h-4 w-4" />A4 PDF</button>
    {receipt && <button type="button" onClick={() => printThermalReceipt(title, rows)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ReceiptText className="h-4 w-4" />Receipt</button>}
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" />Print</button>
  </div>;
}