"use client";

import { ChevronDown, LayoutDashboard, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ui } from "./ui";

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- remote OAuth avatar; no-referrer avoids Google 403s
    return <img src={url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full border border-line object-cover" />;
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-accent-soft font-heading text-sm font-bold text-accent">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function HandlePrompt() {
  const { updateHandle } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await updateHandle(value);
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs" role="dialog" aria-modal="true" aria-labelledby="handle-title">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8">
        <p className={`${ui.eyebrow} mb-2`}>Welcome to APIKUBO</p>
        <h2 id="handle-title" className="mb-2 text-2xl font-bold text-ink">Choose your handle</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted">Everything you publish is attributed to this handle.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="handle" className={ui.label}>Developer handle</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">@</span>
              <input
                id="handle"
                autoFocus
                value={value}
                maxLength={30}
                onChange={(e) => {
                  setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                  setError("");
                }}
                placeholder="yourhandle"
                className={`${ui.input} pl-7 font-mono`}
                aria-invalid={Boolean(error)}
                aria-describedby="handle-help"
              />
            </div>
            {error ? <p className={ui.error}>{error}</p> : <p id="handle-help" className={ui.hint}>3–30 characters: lowercase letters, numbers, - or _</p>}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || value.length < 3} className={ui.buttonPrimary}>
              {saving ? "Saving…" : "Claim handle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { href: "/explore", label: "Explore", mobile: true },
  { href: "/trending", label: "Trending", mobile: true },
  { href: "/submit", label: "Publish", mobile: false },
];

export function Navbar() {
  const { user, profile, loading, signOut, needsHandlePrompt } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const handle = profile?.username ?? "builder";
  const displayName = profile?.display_name ?? user?.fullName ?? "Builder";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className={`${ui.container} flex h-16 items-center justify-between gap-4`}>
          <div className="flex items-center gap-6 sm:gap-8">
            <Link href="/" className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
              APIKUBO
            </Link>
            <nav className="flex items-center gap-4 text-sm sm:gap-6" aria-label="Primary">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`font-medium transition-colors ${link.mobile ? "" : "hidden sm:inline"} ${active ? "text-ink" : "text-muted hover:text-ink"}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {loading ? (
            <div className="h-9 w-9 animate-pulse rounded-full border border-line bg-background" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg border border-transparent p-1 transition-colors hover:border-line hover:bg-background"
                aria-expanded={open}
                aria-haspopup="menu"
              >
                <Avatar name={displayName} url={profile?.avatar_url ?? user.avatarUrl} />
                <span className="hidden text-left sm:block">
                  <span className="block font-mono text-xs font-semibold text-ink">@{handle}</span>
                  <span className="block text-[11px] leading-none text-muted">{displayName}</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {open && (
                <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface py-2 shadow-lg">
                  <div className="mb-1 border-b border-line px-4 pb-2">
                    <p className="text-xs text-muted">Signed in as</p>
                    <p className="truncate font-mono text-xs font-bold text-ink">@{handle}</p>
                  </div>
                  <Link role="menuitem" href="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-background hover:text-accent">
                    <LayoutDashboard className="h-4 w-4 text-muted" aria-hidden /> Dashboard
                  </Link>
                  <Link role="menuitem" href="/submit" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-background hover:text-accent">
                    <Plus className="h-4 w-4 text-muted" aria-hidden /> Publish a listing
                  </Link>
                  <div className="my-1 border-t border-line" />
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-muted hover:bg-red-50 hover:text-danger"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname === "/login" ? "/dashboard" : pathname)}`} className={`${ui.buttonPrimary} px-4 py-2`}>
              Sign in
            </Link>
          )}
        </div>
      </header>
      {needsHandlePrompt && <HandlePrompt />}
    </>
  );
}
