import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const user = data.user;

      // Ensure profiles record exists for first-time login
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        const defaultHandle =
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          `user_${user.id.slice(0, 8)}`;

        await supabase.from("profiles").insert({
          id: user.id,
          username: defaultHandle,
          display_name: user.user_metadata?.full_name || user.user_metadata?.name || defaultHandle,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        });
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, request.url));
}
