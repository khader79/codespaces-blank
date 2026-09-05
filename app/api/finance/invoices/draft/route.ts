import { z } from "zod";
import { STORE_ID } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const draftSchema = z.object({
  storeId: z.coerce.number().int().positive().default(STORE_ID),
  tenantId: z.coerce.number().int().positive().optional(),
  clientOpId: z.string().trim().min(8).max(100),
  invoiceNumber: z.string().trim().min(1).max(50),
  invoiceType: z.enum(["cash", "credit", "proforma"]).default("cash"),
  customerId: z.number().int().positive().nullable().optional(),
  discount: z.number().finite().min(0).default(0),
  tax: z.number().finite().min(0).default(0),
  dueDate: z.string().date().nullable().optional(),
  lines: z.array(z.object({
    productId: z.number().int().positive().nullable().optional(),
    description: z.string().trim().min(1).max(240),
    quantity: z.number().positive(),
    unitPrice: z.number().finite().min(0),
    unitCost: z.number().finite().min(0).default(0),
  })).min(1),
});

export async function POST(req: Request) {
  const parsed = draftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid invoice draft.", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const tenantId = input.tenantId ?? input.storeId;
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const total = Math.max(0, subtotal - input.discount + input.tax);

  const { data: duplicate } = await supabase.from("invoices").select("id").eq("store_id", input.storeId).eq("invoice_number", input.invoiceNumber).maybeSingle();
  if (duplicate) return Response.json({ ok: true, duplicate: true, id: duplicate.id });

  const { data: invoice, error } = await supabase.from("invoices").insert({
    store_id: input.storeId,
    tenant_id: tenantId,
    customer_id: input.customerId ?? null,
    invoice_number: input.invoiceNumber,
    invoice_type: input.invoiceType,
    status: "draft",
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(input.discount.toFixed(2)),
    tax: Number(input.tax.toFixed(2)),
    total: Number(total.toFixed(2)),
    due_date: input.dueDate ?? null,
  }).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { error: linesError } = await supabase.from("invoice_lines").insert(input.lines.map((line) => ({
    invoice_id: invoice.id,
    tenant_id: tenantId,
    product_id: line.productId ?? null,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    unit_cost: line.unitCost,
    line_total: Number((line.quantity * line.unitPrice).toFixed(2)),
  })));
  if (linesError) return Response.json({ error: linesError.message }, { status: 500 });
  return Response.json({ ok: true, duplicate: false, id: invoice.id, total: Number(total.toFixed(2)) }, { status: 201 });
}
