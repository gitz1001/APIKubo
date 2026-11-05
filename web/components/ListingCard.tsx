import { ArrowUpRight, ChevronUp } from "lucide-react";
import Link from "next/link";
import { categoryLabel, startingPrice, typeLabel } from "@/lib/format";
import type { Listing } from "@/lib/types";

export function TypeTag({ type }: { type: Listing["type"] }) {
  const skill = type === "ai_skill";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ${
        skill ? "bg-highlight-soft text-highlight" : "bg-accent-soft text-accent"
      }`}
    >
      {typeLabel(type)}
    </span>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group flex h-full flex-col justify-between rounded-xl border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-sm"
    >
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <TypeTag type={listing.type} />
          <span className="truncate text-xs text-muted">{categoryLabel(listing.category)}</span>
        </div>
        <h3 className="mb-1 flex items-start justify-between gap-2 text-lg font-bold text-ink transition-colors group-hover:text-accent">
          <span>{listing.name}</span>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </h3>
        {listing.provider && <p className="mb-3 font-mono text-xs text-muted">@{listing.provider.username}</p>}
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{listing.tagline ?? listing.description}</p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs">
        <span className="font-mono font-medium text-ink">{startingPrice(listing.plans)}</span>
        <span className="inline-flex items-center gap-1 font-mono text-muted" title="Upvotes">
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          {listing.upvote_count}
        </span>
      </div>
    </Link>
  );
}
