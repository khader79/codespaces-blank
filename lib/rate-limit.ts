import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const fallback = new Map<string, { count: number; resetAt: number }>();
let limiter: Ratelimit | null | undefined;
function getLimiter() {
  if (limiter !== undefined) return limiter;
  limiter = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.fixedWindow(5, "15 m"), prefix: "storeflow:login" })
    : null;
  return limiter;
}
export async function allowLoginAttempt(key: string) {
  const configured = getLimiter();
  if (configured) return (await configured.limit(key)).success;
  const now = Date.now();
  const entry = fallback.get(key);
  if (!entry || entry.resetAt <= now) { fallback.set(key, { count: 1, resetAt: now + 900000 }); return true; }
  if (entry.count >= 5) return false;
  entry.count += 1;
  return true;
}