"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const { signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setSubmitting(true);
      await signInWithGoogle(next);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F3] flex flex-col justify-between text-[#1C1917]">
      {/* Top Header */}
      <header className="border-b border-[#E7E5E4] bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[#1C1917]">
            APIKUBO
          </Link>
          <Link href="/" className="text-xs font-mono text-[#78716C] hover:text-[#1C1917] transition-colors">
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E7E5E4] rounded-2xl p-8 sm:p-10 shadow-xs">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest text-[#1F7A5A] font-semibold mb-2 block">
              Developer Authentication
            </span>
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-[#1C1917] tracking-tight mb-2">
              Sign in to APIKUBO
            </h1>
            <p className="font-['DM_Sans'] text-sm text-[#78716C]">
              Access your API keys, publish skills, and monitor invocation quotas.
            </p>
          </div>

          <div className="space-y-4">
            {/* Single "Continue with Google" Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full h-12 flex items-center justify-center gap-3 px-6 rounded-lg border border-[#E7E5E4] bg-[#FFFFFF] hover:bg-[#FAF8F3] hover:border-[#1F7A5A] text-sm font-medium text-[#1C1917] transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-[#1F7A5A] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{submitting ? "Connecting..." : "Continue with Google"}</span>
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E7E5E4] text-center">
            <p className="text-xs text-[#78716C] leading-relaxed">
              By connecting with Google, you agree to APIKUBO&apos;s developer terms and gateway access rules.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7E5E4] bg-[#FFFFFF] py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-[#78716C]">
          APIKUBO Marketplace &middot; Secure Identity via Supabase Auth
        </div>
      </footer>
    </div>
  );
}
