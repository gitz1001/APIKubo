"use client";

import { Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Listing, ListingType } from "@/lib/types";
import { CATEGORIES, LISTING_TYPES } from "@/lib/validation";
import { ListingCard } from "./ListingCard";
import { ui } from "./ui";

type Sort = "popular" | "newest";

interface Filters {
  q: string;
  type: ListingType | "all";
  category: string;
  sort: Sort;
}

export function CatalogBrowser({ listings, initial }: { listings: Listing[]; initial: Filters }) {
  const pathname = usePathname();
  const [filters, setFilters] = useState<Filters>(initial);

  // Keep the URL shareable. Native replaceState (supported since Next 14.1) avoids a
  // server round-trip per keystroke that router.replace would trigger on a dynamic page.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.category !== "all") params.set("category", filters.category);
    if (filters.sort !== "popular") params.set("sort", filters.sort);
    const query = params.toString();
    const timer = setTimeout(() => window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname), 250);
    return () => clearTimeout(timer);
  }, [filters, pathname]);

  const results = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return listings
      .filter((l) => filters.type === "all" || l.type === filters.type)
      .filter((l) => filters.category === "all" || l.category === filters.category)
      .filter((l) => {
        if (!q) return true;
        const haystack = [l.name, l.tagline, l.description, l.provider?.username, l.provider?.display_name].join(" ").toLowerCase();
        return q.split(/\s+/).every((term) => haystack.includes(term));
      })
      .sort((a, b) =>
        filters.sort === "newest" ? b.created_at.localeCompare(a.created_at) : b.upvote_count - a.upvote_count,
      );
  }, [listings, filters]);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const hasFilters = filters.q || filters.type !== "all" || filters.category !== "all";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search the catalog</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search by name, capability or provider…"
            className={`${ui.input} pl-9`}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <div role="radiogroup" aria-label="Listing type" className="flex rounded-lg border border-line bg-surface p-1">
            {[{ id: "all" as const, label: "All" }, ...LISTING_TYPES].map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={filters.type === t.id}
                onClick={() => update({ type: t.id })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filters.type === t.id ? "bg-accent text-white" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Category"
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
            className={`${ui.input} w-auto py-2`}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <select aria-label="Sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value as Sort })} className={`${ui.input} w-auto py-2`}>
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-muted">
        <span aria-live="polite">
          {results.length} {results.length === 1 ? "result" : "results"}
        </span>
        {hasFilters && (
          <button type="button" onClick={() => setFilters({ q: "", type: "all", category: "all", sort: filters.sort })} className="inline-flex items-center gap-1 hover:text-ink">
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className={`${ui.card} p-12 text-center text-sm text-muted`}>Nothing matches those filters yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
