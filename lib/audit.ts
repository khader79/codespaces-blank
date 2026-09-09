import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Best-effort source IP from common reverse-proxy headers. */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
}

export interface TenantAuditEntry {
  /** Platform tenant the entry belongs to (strict isolation key). */
  tenantId: number;
  storeId?: number | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: number | string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Writes a tenant-level audit entry to the immutable audit_logs table.
 * UPDATE / DELETE are rejected by a database trigger (enforce_immutable_audit).
 */
export async function logTenantAudit(entry: TenantAuditEntry): Promise<void> {
  const { error } = await getSupabaseAdmin().from("audit_logs").insert({
    tenant_id: entry.tenantId,
    store_id: entry.storeId ?? null,
    user_id: entry.userId ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId == null ? null : String(entry.entityId),
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    metadata: entry.metadata ?? null,
    ip_address: entry.ip ?? null,
  });
  if (error) throw error;
}