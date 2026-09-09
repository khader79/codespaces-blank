import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type InventoryStockRow = {
  id: number;
  tenant_id: number;
  warehouse_id: number;
  product_id: number;
  quantity: number;
  updated_at?: string | null;
};

export type RealtimeState = "live" | "polling" | "idle";

type Options = {
  tenantId: number;
  enabled?: boolean;
  pollIntervalMs?: number;
  onInventoryEvent?: (
    row: InventoryStockRow,
    event: "INSERT" | "UPDATE" | "DELETE"
  ) => void;
  onTransferEvent?: () => void;
  onStateChange?: (state: RealtimeState) => void;
};

/**
 * Multi-warehouse realtime inventory engine.
 *
 * Streams `inventory_stock` and `stock_transfers` mutations for the tenant over
 * Supabase Realtime (postgres_changes) so connected dashboards update stock
 * counts instantly. When Realtime is unavailable (mock DB, no RLS visibility)
 * it degrades to a lightweight polling loop so the UI still stays fresh.
 */
export function useInventoryRealtime(options: Options) {
  const onInventoryEvent = useRef(options.onInventoryEvent);
  const onTransferEvent = useRef(options.onTransferEvent);
  const onStateChange = useRef(options.onStateChange);
  const liveRef = useRef(false);

  onInventoryEvent.current = options.onInventoryEvent;
  onTransferEvent.current = options.onTransferEvent;
  onStateChange.current = options.onStateChange;

  useEffect(() => {
    const tenantId = Number(options.tenantId);
    if (!Number.isInteger(tenantId) || tenantId <= 0 || options.enabled === false) {
      onStateChange.current?.("idle");
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = () => {
      if (pollTimer || disposed) return;
      pollTimer = setInterval(() => {
        if (!disposed) onTransferEvent.current?.();
      }, options.pollIntervalMs ?? 20_000);
    };

    const canRealtime =
      typeof window !== "undefined" &&
      typeof supabase.channel === "function" &&
      typeof supabase.subscribe === "function";

    if (!canRealtime) {
      onStateChange.current?.("polling");
      startPolling();
      return () => {
        disposed = true;
        stopPolling();
      };
    }

    // Poll until the live channel confirms it is delivering events.
    const graceTimer = setTimeout(() => {
      if (!disposed && !liveRef.current) startPolling();
    }, 6000);

    const inventoryChannel = supabase
      .channel(`storeflow-inventory-rt-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_stock",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<InventoryStockRow>) => {
          liveRef.current = true;
          const row = (payload.new ?? payload.old) as InventoryStockRow;
          onInventoryEvent.current?.(row, payload.eventType as "INSERT" | "UPDATE" | "DELETE");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_transfers",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          liveRef.current = true;
          onTransferEvent.current?.();
        }
      )
      .subscribe((status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED" | "SUBSCRIBE_ERROR") => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          liveRef.current = true;
          stopPolling();
          onStateChange.current?.("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onStateChange.current?.("polling");
          startPolling();
        }
      });

    return () => {
      disposed = true;
      clearTimeout(graceTimer);
      stopPolling();
      void supabase.removeChannel(inventoryChannel);
    };
  }, [options.tenantId, options.enabled, options.pollIntervalMs]);
}