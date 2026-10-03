"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, profile, loading, signOut, needsHandlePrompt, updateHandle } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [handleError, setHandleError] = useState("");
  const [handleSaving, setHandleSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleInput.trim()) {
      setHandleError("Please enter a valid handle");
      return;
    }
    setHandleSaving(true);
    const ok = await updateHandle(handleInput.trim());
    setHandleSaving(false);
    if (!ok) {
      setHandleError("Handle must be lowercase alphanumeric, dash or underscore");
    }
  };

  const currentHandle = profile?.username || "user";
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentHandle)}`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E7E5E4] bg-[#FFFFFF]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              <span className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[#1C1917]">
                APIKUBO
              </span>
            </Link>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link
                href="/#explore"
                className="font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
              >
                Browse
              </Link>
              <Link
                href={user ? "/submit" : "/login?next=/submit"}
                className="font-medium text-[#78716C] hover:text-[#1C1917] transition-colors flex items-center gap-1.5"
              >
                <span>Submit</span>
                {!user && (
                  <span className="text-[10px] uppercase font-mono text-[#78716C] bg-[#FAF8F3] px-1.5 py-0.5 rounded border border-[#E7E5E4]">
                    Auth
                  </span>
                )}
              </Link>
            </nav>
          </div>

          {/* Right Area: Auth or Avatar Menu */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-9 h-9 rounded-full bg-[#FAF8F3] animate-pulse border border-[#E7E5E4]" />
            ) : user ? (
              /* Authenticated User: Avatar & Handle with Dropdown Menu */
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-[#FAF8F3] border border-transparent hover:border-[#E7E5E4] transition-all focus:outline-none"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <img
                    src={avatarUrl}
                    alt={currentHandle}
                    className="w-9 h-9 rounded-full object-cover border border-[#E7E5E4]"
                  />
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-mono font-semibold text-[#1C1917]">
                      @{currentHandle}
                    </div>
                    <div className="text-[11px] text-[#78716C] leading-none">
                      {profile?.display_name || "Builder"}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-[#78716C] transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E7E5E4] bg-[#FFFFFF] shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1">
                    <div className="px-4 py-2 border-b border-[#E7E5E4] mb-1">
                      <p className="text-xs text-[#78716C]">Signed in as</p>
                      <p className="text-xs font-mono font-bold text-[#1C1917] truncate">
                        @{currentHandle}
                      </p>
                    </div>

                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1C1917] hover:bg-[#FAF8F3] hover:text-[#1F7A5A] transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#78716C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </Link>

                    <Link
                      href="/submit"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1C1917] hover:bg-[#FAF8F3] hover:text-[#1F7A5A] transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#78716C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Submit Listing
                    </Link>

                    <div className="border-t border-[#E7E5E4] my-1" />

                    <button
                      type="button"
                      onClick={async () => {
                        setDropdownOpen(false);
                        await signOut();
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#78716C] hover:text-red-600 hover:bg-red-50/50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Logged Out */
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1F7A5A] hover:bg-[#17624A] text-white text-sm font-medium transition-colors shadow-xs"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* First-Login Prompt for Handle Modal */}
      {needsHandlePrompt && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="text-xs uppercase tracking-widest text-[#1F7A5A] font-semibold mb-2">
              Welcome to APIKUBO
            </div>
            <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-[#1C1917] mb-2">
              Choose your handle
            </h2>
            <p className="font-['DM_Sans'] text-sm text-[#78716C] leading-relaxed mb-6">
              All APIs, AI Skills, and documentation you publish will be attributed to your unique developer handle.
            </p>

            <form onSubmit={handleClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  Developer Handle
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-mono text-[#78716C]">
                    @
                  </span>
                  <input
                    type="text"
                    value={handleInput}
                    onChange={(e) => {
                      setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                      setHandleError("");
                    }}
                    placeholder="yourhandle"
                    required
                    maxLength={30}
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-[#E7E5E4] bg-[#FAF8F3] text-sm font-mono text-[#1C1917] focus:outline-none focus:border-[#1F7A5A] focus:bg-[#FFFFFF] transition-colors"
                  />
                </div>
                {handleError && (
                  <p className="mt-1.5 text-xs text-red-600">{handleError}</p>
                )}
                <p className="mt-1.5 text-[11px] text-[#78716C]">
                  Only lowercase letters, numbers, hyphens, and underscores.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={handleSaving || !handleInput.trim()}
                  className="px-5 py-2.5 rounded-lg bg-[#1F7A5A] hover:bg-[#17624A] text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {handleSaving ? "Saving..." : "Claim Handle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
