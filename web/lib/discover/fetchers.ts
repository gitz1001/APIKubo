import { unstable_cache } from "next/cache";
import { getFeed, type FeedConfig } from "./feeds";
import { normalizeGithubRepo, normalizeHackerNewsHit, normalizeHuggingFace, parseBlocklist, rankItems, sinceDate } from "./normalize";
import type { DiscoverWindow, FeedId, FeedResult } from "./types";

/**
 * Server-only fetchers for public APIs (no HTML scraping). Results are cached in the
 * Next.js data cache for an hour, so page views never hit GitHub directly; failures
 * are NOT cached (unstable_cache skips thrown errors) and are retried after a short
 * cool-down so an outage doesn't turn every page view into an API call.
 */
const REVALIDATE_SECONDS = 3600;
const TIMEOUT_MS = 8000;
const FAILURE_COOLDOWN_MS = 60_000;
const USER_AGENT = "APIKUBO-Discover/1.0 (+https://github.com/gitz1001/apikubo)";

class SourceError extends Error {}

/** Moderator override, e.g. DISCOVER_BLOCKLIST="spam-owner,someone/some-repo". */
const blocklist = () => parseBlocklist(process.env.DISCOVER_BLOCKLIST);

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
    cache: "no-store", // unstable_cache owns caching
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 403 || response.status === 429) throw new SourceError("rate_limited");
  if (!response.ok) throw new SourceError(`http_${response.status}`);
  return response.json();
}

async function fetchGithub(feed: FeedConfig, window: DiscoverWindow): Promise<FeedResult> {
  const since = sinceDate(window).toISOString().slice(0, 10);
  const topics = (feed.githubTopics ?? []).join(" OR ");
  const q = `${topics} in:topics created:>${since} fork:false archived:false`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=60`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  // Optional, server-only. A token with NO scopes is enough for public search (10 -> 30 req/min).
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const body = await getJson(url, headers);
  const raw = typeof body === "object" && body !== null && Array.isArray((body as { items?: unknown }).items)
    ? (body as { items: unknown[] }).items
    : [];
  const now = Date.now();
  return { items: rankItems(raw.map((r) => normalizeGithubRepo(r, now)), { minMetric: 5, blocklist: blocklist() }), fetchedAt: new Date().toISOString(), error: null };
}

async function fetchHuggingFace(kind: "model" | "space"): Promise<FeedResult> {
  const endpoint = kind === "model" ? "models" : "spaces";
  const body = await getJson(`https://huggingface.co/api/${endpoint}?sort=trendingScore&direction=-1&limit=40`);
  const raw = Array.isArray(body) ? body : [];
  const now = Date.now();
  return { items: rankItems(raw.map((r) => normalizeHuggingFace(r, kind, now)), { blocklist: blocklist() }), fetchedAt: new Date().toISOString(), error: null };
}

async function fetchHackerNews(window: DiscoverWindow): Promise<FeedResult> {
  const since = Math.floor(sinceDate(window).getTime() / 1000);
  const url = `https://hn.algolia.com/api/v1/search?tags=show_hn&numericFilters=${encodeURIComponent(`created_at_i>${since},points>=10`)}&hitsPerPage=200`;
  const body = await getJson(url);
  const hits = typeof body === "object" && body !== null && Array.isArray((body as { hits?: unknown }).hits)
    ? (body as { hits: unknown[] }).hits
    : [];
  const now = Date.now();
  return { items: rankItems(hits.map((h) => normalizeHackerNewsHit(h, now)), { blocklist: blocklist() }), fetchedAt: new Date().toISOString(), error: null };
}

const cachedFeed = unstable_cache(
  async (feedId: FeedId, window: DiscoverWindow): Promise<FeedResult> => {
    const feed = getFeed(feedId);
    if (feed.source === "github") return fetchGithub(feed, window);
    if (feed.source === "huggingface") return fetchHuggingFace(feedId === "spaces" ? "space" : "model");
    return fetchHackerNews(window);
  },
  ["discover-feed-v2"], // bump the version whenever normalize.ts changes, or stale results linger for an hour
  { revalidate: REVALIDATE_SECONDS, tags: ["discover"] },
);

const lastFailure = new Map<string, number>();

/** Never throws: a failing source degrades to an empty list with a human-readable error. */
export async function loadFeed(feedId: FeedId, window: DiscoverWindow): Promise<FeedResult> {
  const key = `${feedId}:${window}`;
  const failedAt = lastFailure.get(key);
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) {
    return { items: [], fetchedAt: new Date().toISOString(), error: "Source temporarily unavailable. Retrying shortly." };
  }
  try {
    const result = await cachedFeed(feedId, window);
    lastFailure.delete(key);
    return result;
  } catch (error) {
    lastFailure.set(key, Date.now());
    const rateLimited = error instanceof SourceError && error.message === "rate_limited";
    console.error(`[discover] ${key} failed:`, error instanceof Error ? error.message : error);
    return {
      items: [],
      fetchedAt: new Date().toISOString(),
      error: rateLimited ? "The source is rate-limiting requests. Try again in a few minutes." : "Source temporarily unavailable.",
    };
  }
}
