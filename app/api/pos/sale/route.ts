import { STORE_ID } from "@/lib/tenant";
import { serverRecordSale, formatAuditError } from "@/lib/server-ops";
import { getClientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 15;

function parseStoreId(raw: unknown): number {
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string" && Number(raw) > 0) return Number(raw);
  return STORE_ID;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const storeId = parseStoreId(body.storeId);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const cleaned: Array<{ product_id: number; quantity: number }> = [];
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) continue;
    const rec = it as { product_id?: unknown; quantity?: unknown };
    if (!Number.isFinite(rec.product_id) || Number(rec.quantity) <= 0) continue;
    cleaned.push({
      product_id: Number(rec.product_id),
      quantity: Math.floor(Number(rec.quantity)),
    });
  }

  if (cleaned.length === 0) {
    return Response.json({ error: "No items were provided." }, { status: 400 });
  }

  const warehouseId =
    typeof body.warehouseId === "number" && body.warehouseId > 0
      ? body.warehouseId
      : null;
  const clientOpId =
    typeof body.clientOpId === "string" && body.clientOpId.trim()
      ? body.clientOpId.trim()
      : null;

  try {
    const { duplicate } = await serverRecordSale(storeId, {
      warehouseId,
      clientOpId,
      items: cleaned,
      userId: typeof body.userId === "string" && body.userId ? body.userId : null,
      ip: getClientIp(req),
    });
    return Response.json({ ok: true, duplicate });
  } catch (err) {
    return Response.json(
      { error: formatAuditError(err) },
      { status: err instanceof Error ? 400 : 500 }
    );
  }
}