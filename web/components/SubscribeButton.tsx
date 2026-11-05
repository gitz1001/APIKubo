"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ui } from "./ui";

export function SubscribeButton({ planId, label = "Subscribe free" }: { planId: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function subscribe() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Could not subscribe");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not subscribe");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={subscribe} disabled={pending} className={`${ui.buttonPrimary} w-full`}>
        {pending ? "Subscribing…" : label}
      </button>
      {error && <p className={ui.error} role="alert">{error}</p>}
    </div>
  );
}
