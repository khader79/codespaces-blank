import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Server onboarding is not configured. Set SUPABASE_SERVICE_ROLE_KEY.");
  }
  adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

/**
 * Server-side data client. Uses the service role (bypasses RLS, which is
 * intentional for trusted server flows that already verified the session), and
 * falls back to the anon/mock client only when no service key is configured
 * (e.g. local mock development). Browser-facing access stays RLS-locked.
 */
export function getServerDataClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    url &&
    serviceKey &&
    (url.startsWith("http://") || url.startsWith("https://"))
  ) {
    return getSupabaseAdmin();
  }
  return supabase as SupabaseClient;
}
