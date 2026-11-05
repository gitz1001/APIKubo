import { ArrowUpRight, GitFork, Heart, MessageSquare, Star, TrendingUp } from "lucide-react";
import Link from "next/link";
import { humanizeRepoName } from "@/lib/discover/normalize";
import { SOURCE_LABEL } from "@/lib/discover/feeds";
import type { DiscoverItem } from "@/lib/discover/types";
import { formatNumber, formatRelative } from "@/lib/format";

const METRIC_ICON = { stars: Star, likes: Heart, points: TrendingUp } as const;
const SECONDARY_ICON = { forks: GitFork, downloads: ArrowUpRight, comments: MessageSquare } as const;

/** Prefills the publish form so maintainers can list their project in one click. */
function listingHref(item: DiscoverItem): string {
  const params = new URLSearchParams({ name: humanizeRepoName(item.title), from: "github" });
  if (item.description) params.set("tagline", item.description.slice(0, 140));
  params.set("docs", item.url);
  return `/submit?${params.toString()}`;
}

export function TrendingRow({ item, rank, compact = false }: { item: DiscoverItem; rank: number; compact?: boolean }) {
  const MetricIcon = METRIC_ICON[item.metricLabel];
  const SecondaryIcon = item.secondaryLabel ? SECONDARY_ICON[item.secondaryLabel] : null;
  const showVelocity = item.perDay !== null && item.perDay >= 1;

  return (
    <li className="group flex gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent sm:p-5">
      <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-sm text-muted" aria-label={`Rank ${rank}`}>
        {rank}
      </span>
      {item.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small third-party avatar, host-allowlisted in normalize.ts
        <img src={item.avatarUrl} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-lg border border-line" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-background font-heading text-sm font-bold text-muted">
          {item.title.slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all font-heading font-bold text-ink hover:text-accent"
          >
            {item.title}
            <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </a>
          {item.tag && <span className="font-mono text-[11px] text-muted">{item.tag}</span>}
        </div>
        {item.description && !compact && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1 font-mono text-ink" title={item.metricLabel}>
            <MetricIcon className="h-3.5 w-3.5" aria-hidden /> {formatNumber(item.metric)}
            <span className="sr-only">{item.metricLabel}</span>
          </span>
          {showVelocity && (
            <span className="inline-flex items-center gap-1 font-mono font-medium text-accent" title={`${item.metricLabel} per day since creation`}>
              <TrendingUp className="h-3.5 w-3.5" aria-hidden /> +{formatNumber(Math.round(item.perDay ?? 0))}/day
            </span>
          )}
          {SecondaryIcon && item.secondary !== null && !compact && (
            <span className="inline-flex items-center gap-1 font-mono" title={item.secondaryLabel ?? ""}>
              <SecondaryIcon className="h-3.5 w-3.5" aria-hidden /> {formatNumber(item.secondary)}
            </span>
          )}
          {item.createdAt && <span>created {formatRelative(item.createdAt)}</span>}
          {!compact && <span className="hidden sm:inline">via {SOURCE_LABEL[item.source]}</span>}
        </div>

        {!compact && item.topics.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
            {item.topics.slice(0, 4).map((topic) => (
              <li key={topic} className="rounded-md bg-background px-2 py-0.5 font-mono text-[11px] text-muted">{topic}</li>
            ))}
          </ul>
        )}
      </div>

      {!compact && item.source === "github" && (
        <Link
          href={listingHref(item)}
          className="hidden shrink-0 self-center rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent md:inline-flex"
          title="Maintain this project? Publish it to the APIKUBO marketplace."
        >
          Yours? List it
        </Link>
      )}
    </li>
  );
}
