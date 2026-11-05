import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Browser client. Only call when isSupabaseConfigured() is true. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
