import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE, isDemoAuthAllowed, isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { parseDemoSession } from "@/lib/demo-session";

const PROTECTED_PREFIXES = ["/dashboard", "/submit"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let signedIn = false;

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Refreshed auth cookies must never be cached by a CDN and served to someone else.
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });
    // getUser() validates the JWT with Supabase Auth; getSession() would trust the cookie blindly.
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } else if (isDemoAuthAllowed()) {
    signedIn = parseDemoSession(request.cookies.get(DEMO_SESSION_COOKIE)?.value) !== null;
  }

  const { pathname, search } = request.nextUrl;
  if (!signedIn && PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
