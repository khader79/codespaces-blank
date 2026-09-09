import { cookies } from "next/headers";
import { ACCESS_COOKIE, OPERATOR_COOKIE, verifySessionToken } from "@/lib/auth-server";

export const runtime = "nodejs";
export async function GET() {
  try {
    const token = cookies().get(ACCESS_COOKIE)?.value;
    if (!token) return Response.json({ user: null }, { status: 401 });
    const claims = await verifySessionToken(token, "access");
    const operatorToken = cookies().get(OPERATOR_COOKIE)?.value;
    const operator = operatorToken ? await verifySessionToken(operatorToken, "operator").catch(() => null) : null;
    return Response.json({ user: { id: claims.user_id, tenant_id: operator?.tenant_id ?? claims.tenant_id, tenant_name: operator?.tenant_name ?? claims.tenant_name ?? null, warehouse_id: operator?.warehouse_id ?? claims.warehouse_id, assigned_warehouse_id: operator?.warehouse_id ?? claims.assigned_warehouse_id ?? claims.warehouse_id, role: operator?.role ?? claims.role, allowed_warehouses: operator?.allowed_warehouses ?? claims.allowed_warehouses, impersonating: Boolean(operator) } });
  } catch { return Response.json({ user: null }, { status: 401 }); }
}