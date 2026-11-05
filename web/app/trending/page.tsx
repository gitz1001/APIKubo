import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TrendingRow } from "@/components/discover/TrendingRow";
import { ui } from "@/components/ui";
import { FEEDS, getFeed, SOURCE_LABEL } from "@/lib/discover/feeds";
import { loadFeed } from "@/lib/discover/fetchers";
import type { DiscoverWindow } from "@/lib/discover/types";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trending in AI",
  description: "Fast-rising AI agents, MCP servers, agent skills, models and launches from GitHub, Hugging Face and Hacker News.",
};

type Search = { [key: string]: string | string[] | undefined };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function href(feed: string, window: DiscoverWindow) {
  return `/trending?feed=${feed}${window === "month" ? "&window=month" : ""}`;
}

export default async function TrendingPage({ searchParams }: { searchParams: Search }) {
  const feed = getFeed(one(searchParams.feed));
  const window: DiscoverWindow = one(searchParams.window) === "month" ? "month" : "week";
  const result = await loadFeed(feed.id, window);

  return (
    <main className={`${ui.container} py-12`}>
      <div className="mb-8 max-w-3xl">
        <p className={`${ui.eyebrow} mb-2`}>Discover</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Trending in AI</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The fastest-rising agents, MCP servers, skills, models and launches from GitHub, Hugging Face and Hacker News. Pulled from
          their public APIs and refreshed hourly.
        </p>
      </div>

      <nav aria-label="Feeds" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {FEEDS.map((f) => {
            const active = f.id === feed.id;
            return (
              <li key={f.id}>
                <Link
                  href={href(f.id, window)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                    active ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:border-accent hover:text-ink"
                  }`}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
        <p className="text-sm text-muted">
          {feed.blurb} <span className="whitespace-nowrap">Source: {SOURCE_LABEL[feed.source]}.</span>
        </p>
        {feed.windowed ? (
          <div role="group" aria-label="Time window" className="flex shrink-0 rounded-lg border border-line bg-surface p-1">
            {(["week", "month"] as const).map((w) => (
              <Link
                key={w}
                href={href(feed.id, w)}
                aria-current={w === window ? "true" : undefined}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${w === window ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {w === "week" ? "New this week" : "New this month"}
              </Link>
            ))}
          </div>
        ) : (
          <span className="shrink-0 text-xs text-muted">Ranked by Hugging Face&apos;s trending score</span>
        )}
      </div>

      {result.error ? (
        <div className={`${ui.card} p-10 text-center`}>
          <p className="mb-1 font-medium text-ink">Couldn&apos;t load {feed.label.toLowerCase()} right now</p>
          <p className="text-sm text-muted">{result.error}</p>
        </div>
      ) : result.items.length === 0 ? (
        <p className={`${ui.card} p-10 text-center text-sm text-muted`}>Nothing has broken out in this window yet. Try the monthly view.</p>
      ) : (
        <ol className="space-y-3">
          {result.items.map((item, index) => (
            <TrendingRow key={item.id} item={item} rank={index + 1} />
          ))}
        </ol>
      )}

      <aside className="mt-8 flex gap-3 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <strong className="text-ink">How ranking works:</strong> stars, likes or points per day with an age decay, so fast risers beat
          big-but-old projects. Repos with many stars but almost no forks are ranked lower, a common sign of purchased stars. Listings
          here are discovered automatically and are not endorsements or security reviews. Updated {formatRelative(result.fetchedAt)}.
        </p>
      </aside>
    </main>
  );
}
