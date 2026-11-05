"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { ui } from "@/components/ui";
import { formatNumber, formatPrice } from "@/lib/format";
import type { SubscriptionSummary, UsageSummary } from "@/lib/types";
import { useMutation } from "./useMutation";

export function SubscriptionsPanel({ subscriptions, usage }: { subscriptions: SubscriptionSummary[]; usage: Record<string, UsageSummary> }) {
  const { run, pending, error } = useMutation();
  const current = subscriptions.filter((s) => s.status !== "canceled" && s.listing && s.plan);

  async function cancel(sub: SubscriptionSummary) {
    if (!window.confirm(`Cancel your ${sub.plan?.name} plan for ${sub.listing?.name}? Calls will be rejected immediately.`)) return;
    await run(sub.id, `/api/subscriptions/${sub.id}`, "DELETE");
  }

  return (
    <section className={`${ui.card} p-6`} aria-labelledby="subs-title">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 id="subs-title" className="text-lg font-bold text-ink">Subscriptions</h2>
          <p className="text-xs text-muted">Usage resets on the 1st of each month (UTC).</p>
        </div>
        <Layers className="h-5 w-5 text-muted" aria-hidden />
      </div>
      {error && <p className={`${ui.error} mb-4`} role="alert">{error}</p>}
      {current.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
          <p className="mb-3">You haven&apos;t subscribed to anything yet.</p>
          <Link href="/explore" className={ui.buttonSecondary}>Browse the catalog</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {current.map((sub) => {
            const listing = sub.listing!;
            const plan = sub.plan!;
            const used = usage[listing.id]?.requests ?? 0;
            const pct = Math.min(100, Math.round((used / plan.quota_monthly) * 100));
            return (
              <li key={sub.id} className="rounded-lg border border-line p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/listings/${listing.slug}`} className="font-medium text-ink hover:text-accent">{listing.name}</Link>
                    <p className="font-mono text-xs text-muted">
                      {plan.name} plan{plan.price_cents > 0 ? ` · ${formatPrice(plan.price_cents)}` : ""} · {formatNumber(plan.rate_limit_rpm)} rpm
                    </p>
                  </div>
                  <button type="button" onClick={() => void cancel(sub)} disabled={pending !== null} className={`${ui.buttonGhost} px-2 py-1 text-xs`}>
                    {pending === sub.id ? "Canceling…" : "Cancel"}
                  </button>
                </div>
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>{formatNumber(used)} / {formatNumber(plan.quota_monthly)} requests this month</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${listing.name} quota used`}>
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-highlight" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
