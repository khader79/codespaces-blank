import { STORE_ID } from "@/lib/tenant";
import { getClientIp } from "@/lib/audit";
import {
  serverCreateProduct,
  serverUpdateProduct,
  serverDeleteProduct,
  formatAuditError,
} from "@/lib/server-ops";

export const runtime = "nodejs";
export const maxDuration = 15;

function parseStoreId(raw: unknown): number {
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string" && Number(raw) > 0) return Number(raw);
  return STORE_ID;
}

function parseNum(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const storeId = parseStoreId(body.storeId);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = parseNum(body.price);
  const stock = parseNum(body.stock) ?? 0;

  if (!name) {
    return Response.json({ error: "Product name is required." }, { status: 400 });
  }
  if (price === undefined || price < 0) {
    return Response.json({ error: "Valid price is required." }, { status: 400 });
  }

  try {
    const { id } = await serverCreateProduct(storeId, { name, price, stock, ip: getClientIp(req) });
    return Response.json({ id, store_id: storeId, name, price, stock });
  } catch (err) {
    return Response.json(
      { error: formatAuditError(err) },
      { status: err instanceof Error ? 400 : 500 }
    );
  }
}

export async function PATCH(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const storeId = parseStoreId(body.storeId);
  const id = parseNum(body.id);
  if (id === undefined) {
    return Response.json({ error: "Product id is required." }, { status: 400 });
  }

  try {
    await serverUpdateProduct(storeId, {
      id,
      name: typeof body.name === "string" ? body.name : undefined,
      price: parseNum(body.price),
      stock: parseNum(body.stock),
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

export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const storeId = parseStoreId(body.storeId);
  const id = parseNum(body.id);
  if (id === undefined) {
    return Response.json({ error: "Product id is required." }, { status: 400 });
  }

  try {
    await serverDeleteProduct(storeId, { id, ip: getClientIp(req) });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: formatAuditError(err) },
      { status: err instanceof Error ? 400 : 500 }
    );
  }
}