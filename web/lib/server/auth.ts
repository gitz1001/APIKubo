import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE, isDemoAuthAllowed, isSupabaseConfigured } from "@/lib/env";
import { parseDemoSession } from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";

/** The authenticated user for this request, verified server-side, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await createClient().auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }
  if (!isDemoAuthAllowed()) return null;
  const session = parseDemoSession(cookies().get(DEMO_SESSION_COOKIE)?.value);
  return session ? { id: session.id, email: session.email } : null;
}

/** Demo-mode display handle (Supabase mode reads it from the profiles table). */
export function getDemoUsername(): string | null {
  if (!isDemoAuthAllowed()) return null;
  return parseDemoSession(cookies().get(DEMO_SESSION_COOKIE)?.value)?.username ?? null;
}
