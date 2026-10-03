"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "./supabase/client";

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  is_first_login?: boolean;
}

interface AuthContextType {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
      picture?: string;
      name?: string;
      custom_claims?: Record<string, unknown>;
    };
  } | null;
  profile: UserProfile | null;
  loading: boolean;
  needsHandlePrompt: boolean;
  setNeedsHandlePrompt: (val: boolean) => void;
  updateHandle: (newHandle: string) => Promise<boolean>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsHandlePrompt, setNeedsHandlePrompt] = useState(false);

  const supabase = createClient();

  const loadSessionAndProfile = async () => {
    try {
      // 1. Check Supabase Auth
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        
        // Fetch or ensure profile row
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (existingProfile) {
          setProfile(existingProfile);
          // Check if handle is still the default auto-generated one
          if (!existingProfile.username || existingProfile.username.startsWith("user_")) {
            setNeedsHandlePrompt(true);
          }
        } else {
          // Trigger first-login profile setup
          const defaultHandle =
            session.user.user_metadata?.username ||
            session.user.email?.split("@")[0] ||
            `user_${session.user.id.slice(0, 8)}`;

          const newProfile: UserProfile = {
            id: session.user.id,
            username: defaultHandle,
            display_name: session.user.user_metadata?.full_name || defaultHandle,
            avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
            is_first_login: true,
          };

          try {
            await supabase.from("profiles").upsert(newProfile);
          } catch {
            // RLS or schema fallback
          }

          setProfile(newProfile);
          setNeedsHandlePrompt(true);
        }
        setLoading(false);
        return;
      }

      // 2. Check local dev / demo session cookie for environments without live Supabase credentials
      const cookieMatch = document.cookie
        .split("; ")
        .find((row) => row.startsWith("apikubo_dev_session="));

      if (cookieMatch) {
        const decoded = JSON.parse(decodeURIComponent(cookieMatch.split("=")[1]));
        if (decoded?.id) {
          setUser(decoded);
          const savedProfile = localStorage.getItem(`apikubo_profile_${decoded.id}`);
          if (savedProfile) {
            const p = JSON.parse(savedProfile);
            setProfile(p);
            if (!p.username || p.username.startsWith("user_")) {
              setNeedsHandlePrompt(true);
            }
          } else {
            const initialProfile: UserProfile = {
              id: decoded.id,
              username: decoded.user_metadata?.username || "developer",
              display_name: decoded.user_metadata?.full_name || "APIKUBO Builder",
              avatar_url: decoded.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
              is_first_login: true,
            };
            localStorage.setItem(`apikubo_profile_${decoded.id}`, JSON.stringify(initialProfile));
            setProfile(initialProfile);
            setNeedsHandlePrompt(true);
          }
        }
      }
    } catch (e) {
      console.error("Auth initialization error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          loadSessionAndProfile();
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setNeedsHandlePrompt(false);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (redirectTo?: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const callbackUrl = `${origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ""}`;

    const isMock =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock-apikubo") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project-id");

    if (!isMock) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        console.error("Supabase Google Auth error:", error.message);
      }
    } else {
      // Local dev simulation: create a verified session that survives refresh
      const mockUser = {
        id: "usr_google_test_" + Math.random().toString(36).substring(2, 9),
        email: "alex.builder@apikubo.dev",
        user_metadata: {
          full_name: "Alex Rivera",
          name: "Alex Rivera",
          avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          picture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        },
      };
      // Set session cookie for middleware (survives refresh)
      document.cookie = `apikubo_dev_session=${encodeURIComponent(JSON.stringify(mockUser))}; path=/; max-age=604800; SameSite=Lax`;
      
      const initialProfile: UserProfile = {
        id: mockUser.id,
        username: "user_" + mockUser.id.slice(16),
        display_name: mockUser.user_metadata.full_name,
        avatar_url: mockUser.user_metadata.avatar_url,
        is_first_login: true,
      };
      localStorage.setItem(`apikubo_profile_${mockUser.id}`, JSON.stringify(initialProfile));

      setUser(mockUser);
      setProfile(initialProfile);
      setNeedsHandlePrompt(true);

      const target = redirectTo || "/dashboard";
      window.location.href = target;
    }
  };

  const updateHandle = async (newHandle: string) => {
    const cleanHandle = newHandle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanHandle || !user) return false;

    if (profile) {
      const updated = { ...profile, username: cleanHandle, is_first_login: false };
      setProfile(updated);

      if (user.id.startsWith("usr_google_test_")) {
        localStorage.setItem(`apikubo_profile_${user.id}`, JSON.stringify(updated));
      } else {
        await supabase
          .from("profiles")
          .update({ username: cleanHandle, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }
    setNeedsHandlePrompt(false);
    return true;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignored in mock
    }
    // Clear cookies & local storage
    document.cookie = "apikubo_dev_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    if (user?.id) {
      localStorage.removeItem(`apikubo_profile_${user.id}`);
    }
    setUser(null);
    setProfile(null);
    setNeedsHandlePrompt(false);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsHandlePrompt,
        setNeedsHandlePrompt,
        updateHandle,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
