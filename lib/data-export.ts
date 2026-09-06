export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function escapeCsv(value: ExportRow[string]): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\n");
}

export function downloadRows(filename: string, rows: ExportRow[], excel = false): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob([excel ? `\ufeff${csv}` : csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadA4Pdf(title: string, rows: ExportRow[]): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  autoTableModule.default(doc, { head: [headers], body: rows.map((row) => headers.map((header) => String(row[header] ?? ""))), startY: 26 });
  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

export function printThermalReceipt(title: string, rows: ExportRow[]): void {
  const receipt = window.open("", "storeflow-receipt", "width=420,height=700");
  if (!receipt) return;
  const body = rows.map((row) => `<div class="row"><span>${String(row.item ?? row.name ?? "Item")}</span><strong>${String(row.total ?? row.amount ?? "")}</strong></div>`).join("");
  receipt.document.write(`<html><head><title>${title}</title><style>@page{size:80mm auto;margin:0}body{font:12px monospace;width:72mm;margin:8mm auto}.row{display:flex;justify-content:space-between;border-bottom:1px dotted #999;padding:5px 0}h1{text-align:center;font-size:16px}</style></head><body><h1>${title}</h1>${body}</body></html>`);
  receipt.document.close();
  receipt.focus();
  receipt.print();
}