"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEMO_SESSION_COOKIE, isDemoAuthAllowed, isSupabaseConfigured } from "@/lib/env";
import { DEMO_USER_ID, parseDemoSession, serializeDemoSession, type DemoSession } from "@/lib/demo-session";
import { createClient } from "@/lib/supabase/client";
import { validateHandle } from "@/lib/validation";

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

type HandleResult = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  /** Auto-generated handles (user_xxxx) prompt the user to pick a real one. */
  needsHandlePrompt: boolean;
  updateHandle: (handle: string) => Promise<HandleResult>;
  signInWithGoogle: (next: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readDemoSession(): DemoSession | null {
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${DEMO_SESSION_COOKIE}=`))
    ?.slice(DEMO_SESSION_COOKIE.length + 1);
  return parseDemoSession(raw);
}

function writeDemoSession(session: DemoSession | null) {
  document.cookie = session
    ? `${DEMO_SESSION_COOKIE}=${serializeDemoSession(session)}; path=/; max-age=604800; SameSite=Lax`
    : `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseMode = isSupabaseConfigured();
  const demoMode = !supabaseMode && isDemoAuthAllowed();
  const supabase = useMemo(() => (supabaseMode ? createClient() : null), [supabaseMode]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        const authUser = data.user;
        if (!authUser) {
          setUser(null);
          setProfile(null);
          return;
        }
        const meta = authUser.user_metadata as Record<string, unknown>;
        const text = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : null);
        setUser({
          id: authUser.id,
          email: authUser.email ?? null,
          fullName: text("full_name") ?? text("name"),
          avatarUrl: text("avatar_url") ?? text("picture"),
        });
        const { data: row } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle();
        setProfile((row as UserProfile | null) ?? null);
        return;
      }
      if (demoMode) {
        const session = readDemoSession();
        setUser(session ? { id: session.id, email: session.email, fullName: session.full_name, avatarUrl: null } : null);
        setProfile(session ? { id: session.id, username: session.username, display_name: session.full_name, avatar_url: null } : null);
      }
    } catch (error) {
      console.error("[auth] failed to load session", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, demoMode]);

  useEffect(() => {
    void load();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "SIGNED_OUT") void load();
    });
    return () => data.subscription.unsubscribe();
  }, [load, supabase]);

  const signInWithGoogle = useCallback(
    async (next: string) => {
      if (supabase) {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
        if (error) throw error;
        return;
      }
      if (!demoMode) throw new Error("Sign-in is not configured. Set the Supabase environment variables.");
      writeDemoSession({ id: DEMO_USER_ID, email: "builder@apikubo.dev", full_name: "Demo Builder", username: "user_demo" });
      window.location.assign(next);
    },
    [supabase, demoMode],
  );

  const updateHandle = useCallback(
    async (handle: string): Promise<HandleResult> => {
      const parsed = validateHandle(handle);
      if (!parsed.ok) return { ok: false, error: parsed.errors.handle };
      if (!user || !profile) return { ok: false, error: "You are signed out" };

      if (supabase) {
        const { error } = await supabase.from("profiles").update({ username: parsed.value }).eq("id", user.id);
        if (error) {
          return { ok: false, error: error.code === "23505" ? "That handle is already taken" : "Could not save your handle" };
        }
      } else {
        const session = readDemoSession();
        if (session) writeDemoSession({ ...session, username: parsed.value });
      }
      setProfile({ ...profile, username: parsed.value });
      return { ok: true };
    },
    [supabase, user, profile],
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    writeDemoSession(null);
    setUser(null);
    setProfile(null);
    window.location.assign("/");
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isDemo: demoMode,
      needsHandlePrompt: Boolean(user && profile && profile.username.startsWith("user_")),
      updateHandle,
      signInWithGoogle,
      signOut,
    }),
    [user, profile, loading, demoMode, updateHandle, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
