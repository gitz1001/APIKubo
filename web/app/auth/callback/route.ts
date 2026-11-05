import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/**
 * OAuth return URL. The profile row is created by the on_auth_user_created trigger,
 * so nothing else needs writing here. `next` is restricted to same-site paths to
 * prevent this route being used as an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (!isSupabaseConfigured() || !code) {
    return NextResponse.redirect(new URL(`/login?error=oauth&next=${encodeURIComponent(next)}`, url.origin));
  }

  const { error } = await createClient().auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth] code exchange failed", error.message);
    return NextResponse.redirect(new URL(`/login?error=oauth&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
