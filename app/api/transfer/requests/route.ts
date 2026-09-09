import { z } from "zod";
import { STORE_ID } from "@/lib/tenant";
import { getClientIp } from "@/lib/audit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  formatAuditError,
  serverApproveTransferRequest,
  serverCreateTransferRequest,
  serverRejectTransferRequest,
} from "@/lib/server-ops";

export const runtime = "nodejs";
export const maxDuration = 15;

function parseStoreId(raw: unknown): number {
  if (typeof raw === "number" && raw > 0) return raw;
  if (typeof raw === "string" && Number(raw) > 0) return Number(raw);
  return STORE_ID;
}

const joinSelect =
  "*, product:products(name), from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(name), to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(name)";

export async function GET(request: Request) {
  const storeId = parseStoreId(new URL(request.url).searchParams.get("storeId"));
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("stock_transfers")
      .select(joinSelect)
      .eq("store_id", storeId)
      .in("status", ["pending", "rejected"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ transfers: data ?? [] });
  } catch (err) {
    return Response.json({ error: formatAuditError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = z
    .object({
      storeId: z.union([z.number().int().positive(), z.string()]).optional(),
      productId: z.number().int().positive(),
      fromWarehouseId: z.number().int().positive(),
      toWarehouseId: z.number().int().positive(),
      quantity: z.number().int().positive(),
      note: z.string().nullable().optional(),
      userId: z.string().nullable().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid transfer request." },
      { status: 400 }
    );
  }

  const storeId = parseStoreId(parsed.data.storeId);
  try {
    const { id } = await serverCreateTransferRequest(storeId, {
      productId: parsed.data.productId,
      fromWarehouseId: parsed.data.fromWarehouseId,
      toWarehouseId: parsed.data.toWarehouseId,
      quantity: parsed.data.quantity,
      note: parsed.data.note ?? null,
      userId: parsed.data.userId ?? null,
      ip: getClientIp(request),
    });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: formatAuditError(err) },
      { status: err instanceof Error ? 400 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const parsed = z
    .object({
      storeId: z.union([z.number().int().positive(), z.string()]).optional(),
      id: z.number().int().positive(),
      action: z.enum(["approve", "reject"]),
      userId: z.string().nullable().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid transfer payload." },
      { status: 400 }
    );
  }

  const storeId = parseStoreId(parsed.data.storeId);
  try {
    const input = { userId: parsed.data.userId ?? null, ip: getClientIp(request) };
    if (parsed.data.action === "approve") {
      await serverApproveTransferRequest(storeId, parsed.data.id, input);
    } else {
      await serverRejectTransferRequest(storeId, parsed.data.id, input);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: formatAuditError(err) },
      { status: err instanceof Error ? 400 : 500 }
    );
  }
}