import { STORE_ID } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function storeIdFrom(url: string): number {
  const raw = new URL(url).searchParams.get("storeId");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : STORE_ID;
}

function amount(value: unknown): number {
  return Number(value ?? 0) || 0;
}

type SaleSummaryRow = { quantity: unknown; unit_price: unknown; unit_cost: unknown };
type InvoiceSummaryRow = { status: unknown; total: unknown; paid: unknown };
type PaymentSummaryRow = { amount: unknown };

export async function GET(req: Request) {
  const storeId = storeIdFrom(req.url);
  const [salesResult, invoicesResult, paymentsResult] = await Promise.all([
    supabase.from("sales").select("quantity, unit_price, unit_cost").eq("store_id", storeId),
    supabase.from("invoices").select("status, total, paid").eq("store_id", storeId),
    supabase.from("payments").select("amount").eq("store_id", storeId),
  ]);

  const firstError = salesResult.error ?? invoicesResult.error ?? paymentsResult.error;
  if (firstError) {
    return Response.json({ error: firstError.message }, { status: 500 });
  }

  const sales = (salesResult.data ?? []) as SaleSummaryRow[];
  const invoices = (invoicesResult.data ?? []) as InvoiceSummaryRow[];
  const payments = (paymentsResult.data ?? []) as PaymentSummaryRow[];
  const revenue = sales.reduce((sum, row) => sum + amount(row.quantity) * amount(row.unit_price), 0);
  const cost = sales.reduce((sum, row) => sum + amount(row.quantity) * amount(row.unit_cost), 0);
  const invoiced = invoices.reduce((sum, row) => sum + amount(row.total), 0);
  const receivables = invoices
    .filter((row) => row.status !== "paid" && row.status !== "void")
    .reduce((sum, row) => sum + Math.max(0, amount(row.total) - amount(row.paid)), 0);

  return Response.json({
    revenue: Number(revenue.toFixed(2)),
    costOfGoodsSold: Number(cost.toFixed(2)),
    grossProfit: Number((revenue - cost).toFixed(2)),
    invoiced: Number(invoiced.toFixed(2)),
    cashCollected: Number(payments.reduce((sum, row) => sum + amount(row.amount), 0).toFixed(2)),
    receivables: Number(receivables.toFixed(2)),
    invoiceCount: invoices.length,
  });
}
