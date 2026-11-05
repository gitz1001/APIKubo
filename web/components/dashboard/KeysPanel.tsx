"use client";

import { AlertTriangle, KeyRound } from "lucide-react";
import React, { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { ui } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { ApiKeySummary } from "@/lib/types";
import { useMutation } from "./useMutation";

export function KeysPanel({ keys }: { keys: ApiKeySummary[] }) {
  const { run, pending, error } = useMutation();
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ name: string; secret: string } | null>(null);
  const active = keys.filter((k) => !k.revoked_at);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const keyName = name.trim() || "Default key";
    const result = await run<{ secret: string }>("create", "/api/keys", "POST", { name: keyName });
    if (result?.secret) {
      setRevealed({ name: keyName, secret: result.secret });
      setName("");
    }
  }

  async function revoke(key: ApiKeySummary) {
    if (!window.confirm(`Revoke "${key.name}"? Apps using it will start receiving 403 errors.`)) return;
    await run(key.id, `/api/keys/${key.id}`, "DELETE");
  }

  return (
    <section className={`${ui.card} p-6`} aria-labelledby="keys-title">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 id="keys-title" className="text-lg font-bold text-ink">API keys</h2>
          <p className="text-xs text-muted">One key works for every listing you subscribe to. {active.length}/10 active.</p>
        </div>
        <KeyRound className="h-5 w-5 text-muted" aria-hidden />
      </div>

      {revealed && (
        <div className="mb-5 rounded-lg border border-highlight/40 bg-highlight-soft p-4" role="status">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-highlight">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Copy “{revealed.name}” now — it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface p-2">
            <code className="flex-1 select-all break-all font-mono text-xs text-ink">{revealed.secret}</code>
            <CopyButton value={revealed.secret} className="shrink-0 text-accent hover:bg-accent-soft" />
          </div>
          <button type="button" onClick={() => setRevealed(null)} className="mt-2 text-xs text-highlight underline">
            I&apos;ve stored it safely
          </button>
        </div>
      )}

      <form onSubmit={create} className="mb-5 flex gap-2">
        <label htmlFor="key-name" className="sr-only">Key name</label>
        <input
          id="key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          placeholder="Key name, e.g. production-server"
          className={ui.input}
        />
        <button type="submit" disabled={pending !== null || active.length >= 10} className={`${ui.buttonPrimary} shrink-0`}>
          {pending === "create" ? "Creating…" : "Create key"}
        </button>
      </form>
      {error && <p className={`${ui.error} mb-4`} role="alert">{error}</p>}

      {keys.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">No keys yet. Create one to start calling the gateway.</p>
      ) : (
        <ul className="divide-y divide-line">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${key.revoked_at ? "text-muted line-through" : "text-ink"}`}>{key.name}</p>
                <p className="font-mono text-xs text-muted">
                  {key.key_prefix}… · created {formatDate(key.created_at)} · {key.last_used_at ? `last used ${formatDate(key.last_used_at)}` : "never used"}
                </p>
              </div>
              {key.revoked_at ? (
                <span className="rounded-md bg-background px-2 py-1 font-mono text-[11px] text-muted">revoked</span>
              ) : (
                <button type="button" onClick={() => void revoke(key)} disabled={pending !== null} className={`${ui.buttonDanger} px-3 py-1.5 text-xs`}>
                  {pending === key.id ? "Revoking…" : "Revoke"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
