import { Redis } from "@upstash/redis";

export const MAINTENANCE_FLAG = "storeflow:maintenance_mode";
const CACHE_TTL_MS = 8000;

let cached: { value: boolean; at: number } | null = null;

function getRedis() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  return null;
}

export async function readMaintenance(now = Date.now()): Promise<boolean> {
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  let value: boolean | null = null;
  const redis = getRedis();
  if (redis) {
    try {
      const flag = await redis.get(MAINTENANCE_FLAG);
      value = flag === "1";
    } catch {
      value = null;
    }
  }

  if (value === null) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const response = await fetch(
          `${url}/rest/v1/platform_settings?select=maintenance_mode&id=eq.1`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
        );
        if (response.ok) {
          const rows = (await response.json()) as { maintenance_mode?: boolean }[];
          value = Boolean(rows?.[0]?.maintenance_mode);
        }
      }
    } catch {
      value = null;
    }
  }

  if (value !== null) cached = { value, at: now };
  return value ?? false;
}

export async function setMaintenance(enabled: boolean) {
  cached = { value: enabled, at: Date.now() };
  const redis = getRedis();
  if (!redis) return;
  try {
    if (enabled) await redis.set(MAINTENANCE_FLAG, "1", { ex: 86400 });
    else await redis.del(MAINTENANCE_FLAG);
  } catch {
    // DB remains the source of truth; Redis is a fast-path cache.
  }
}