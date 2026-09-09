import { STORE_ID } from "@/lib/tenant";
import { serverTransfer, formatAuditError } from "@/lib/server-ops";
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
  const productId = Number(body.productId);
  const fromWarehouseId = Number(body.fromWarehouseId);
  const toWarehouseId = Number(body.toWarehouseId);
  const quantity = Math.floor(Number(body.quantity));

  if (!Number.isFinite(productId) || productId <= 0) {
    return Response.json({ error: "Valid product id is required." }, { status: 400 });
  }
  if (!Number.isFinite(fromWarehouseId) || !Number.isFinite(toWarehouseId)) {
    return Response.json({ error: "Valid warehouse ids are required." }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return Response.json({ error: "Quantity must be a positive integer." }, { status: 400 });
  }

  try {
    await serverTransfer(storeId, {
      productId,
      fromWarehouseId,
      toWarehouseId,
      quantity,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      userId: typeof body.userId === "string" && body.userId ? body.userId : null,
      ip: getClientIp(req),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: formatAuditError(err) },
      { status: err instanceof Error ? 400 : 500 }
    );
  }
}