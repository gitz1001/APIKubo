"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ui } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/validation";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { signInWithGoogle, isDemo } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(params.get("error") === "oauth" ? "Sign-in was cancelled or failed. Please try again." : "");
  const configured = isSupabaseConfigured() || isDemo;

  async function signIn() {
    setPending(true);
    setError("");
    try {
      await signInWithGoogle(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start sign-in");
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-xs sm:p-10">
      <div className="mb-8 text-center">
        <p className={`${ui.eyebrow} mb-2`}>Developer access</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-ink">Sign in to APIKUBO</h1>
        <p className="text-sm text-muted">Manage API keys, subscriptions and the listings you publish.</p>
      </div>

      <button
        type="button"
        onClick={signIn}
        disabled={pending || !configured}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-6 text-sm font-medium text-ink transition-all hover:border-accent hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden /> : <GoogleIcon />}
        <span>{pending ? "Connecting…" : isDemo ? "Continue with demo account" : "Continue with Google"}</span>
      </button>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-danger" role="alert">{error}</p>}
      {isDemo && (
        <p className="mt-4 text-center text-xs text-muted">Demo mode: no Supabase configured, so you&apos;ll sign in as a local test user.</p>
      )}
      {!configured && (
        <p className="mt-4 text-center text-xs text-muted">Sign-in is not configured on this deployment.</p>
      )}

      <p className="mt-8 border-t border-line pt-6 text-center text-xs leading-relaxed text-muted">
        By continuing you agree to APIKUBO&apos;s developer terms and acceptable-use policy.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center px-4 py-16">
      {/* useSearchParams needs a Suspense boundary for static prerendering. */}
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-2xl border border-line bg-surface" />}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
