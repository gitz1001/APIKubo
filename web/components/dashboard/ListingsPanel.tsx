"use client";

import { Store } from "lucide-react";
import Link from "next/link";
import { TypeTag } from "@/components/ListingCard";
import { ui } from "@/components/ui";
import type { ListingStatus, OwnedListing } from "@/lib/types";
import { useMutation } from "./useMutation";

const STATUS_STYLE: Record<ListingStatus, string> = {
  published: "bg-accent-soft text-accent",
  draft: "bg-highlight-soft text-highlight",
  archived: "bg-background text-muted",
};

export function ListingsPanel({ listings }: { listings: OwnedListing[] }) {
  const { run, pending, error } = useMutation();

  async function setStatus(listing: OwnedListing, status: ListingStatus) {
    if (status === "archived" && !window.confirm(`Archive "${listing.name}"? Consumers will lose access through the gateway.`)) return;
    await run(listing.id, `/api/listings/${listing.id}`, "PATCH", { status });
  }

  return (
    <section className={`${ui.card} p-6`} aria-labelledby="listings-title">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 id="listings-title" className="text-lg font-bold text-ink">Your listings</h2>
          <p className="text-xs text-muted">What you publish to the marketplace.</p>
        </div>
        <Link href="/submit" className={`${ui.buttonSecondary} px-3 py-1.5 text-xs`}>
          <Store className="h-3.5 w-3.5" aria-hidden /> New listing
        </Link>
      </div>
      {error && <p className={`${ui.error} mb-4`} role="alert">{error}</p>}
      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
          You haven&apos;t published anything yet. Listing an API takes about two minutes.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <Link href={`/listings/${listing.slug}`} className="truncate font-medium text-ink hover:text-accent">{listing.name}</Link>
                  <TypeTag type={listing.type} />
                  <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${STATUS_STYLE[listing.status]}`}>{listing.status}</span>
                </div>
                <p className="truncate font-mono text-xs text-muted">/v1/{listing.slug} → {listing.base_url ?? "no upstream"}</p>
              </div>
              <div className="flex gap-2">
                {listing.status !== "published" && (
                  <button type="button" disabled={pending !== null} onClick={() => void setStatus(listing, "published")} className={`${ui.buttonPrimary} px-3 py-1.5 text-xs`}>
                    {pending === listing.id ? "Saving…" : "Publish"}
                  </button>
                )}
                {listing.status === "published" && (
                  <button type="button" disabled={pending !== null} onClick={() => void setStatus(listing, "draft")} className={`${ui.buttonSecondary} px-3 py-1.5 text-xs`}>
                    Unpublish
                  </button>
                )}
                {listing.status !== "archived" && (
                  <button type="button" disabled={pending !== null} onClick={() => void setStatus(listing, "archived")} className={`${ui.buttonGhost} px-3 py-1.5 text-xs`}>
                    Archive
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
