"use client";

import React from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { profile, user } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1C1917]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-12">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-[#1F7A5A] font-semibold mb-2">
            Developer Workspace
          </div>
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold tracking-tight text-[#1C1917]">
            Dashboard
          </h1>
          <p className="font-['DM_Sans'] text-sm text-[#78716C] mt-1">
            Welcome back, <span className="font-mono text-[#1C1917]">@{profile?.username || user?.email}</span>
          </p>
        </div>

        <div className="p-8 rounded-xl border border-[#E7E5E4] bg-[#FFFFFF] text-center max-w-lg">
          <div className="w-12 h-12 rounded-full bg-[#FAF8F3] border border-[#E7E5E4] flex items-center justify-center mx-auto mb-4 text-[#1F7A5A]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[#1C1917] mb-2">
            Workspace Shell Ready
          </h2>
          <p className="font-['DM_Sans'] text-sm text-[#78716C] leading-relaxed">
            Your developer identity is authenticated via Supabase. Dashboard metrics, active subscriptions, and API key management will be connected in subsequent phases.
          </p>
        </div>
      </main>
    </div>
  );
}
