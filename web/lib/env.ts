/**
 * Runtime configuration shared by server, client and middleware code.
 * NEXT_PUBLIC_* values are inlined at build time, so this file is safe everywhere.
 */

const PLACEHOLDER_MARKERS = ["your-project-id", "mock-apikubo", "dummy"];

export const DEMO_SESSION_COOKIE = "apikubo_dev_session";

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/** True when real Supabase credentials (not the .env.example placeholders) are present. */
export function isSupabaseConfigured(): boolean {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return false;
  return !PLACEHOLDER_MARKERS.some((marker) => url.includes(marker) || key.includes(marker));
}

/**
 * Demo auth trusts a client-set cookie, so it is ONLY allowed when Supabase is not
 * configured AND we are not running a production build. Never widen this check.
 */
export function isDemoAuthAllowed(): boolean {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== "production";
}

export function gatewayUrl(): string {
  return (process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000").replace(/\/+$/, "");
}
