/**
 * Pure functions that turn third-party API payloads into DiscoverItems and rank them.
 * Every field from an external API is treated as untrusted: type-checked, length-capped,
 * and URLs are restricted to http(s) on the host we expect. No network, no Next.js
 * imports, so this is unit tested with `node --test`.
 */
import type { DiscoverItem, DiscoverWindow } from "./types";

const DAY_MS = 86_400_000;
export const MIN_REPO_KB = 20;

export function windowDays(window: DiscoverWindow): number {
  return window === "month" ? 30 : 7;
}

export function sinceDate(window: DiscoverWindow, now: number = Date.now()): Date {
  return new Date(now - windowDays(window) * DAY_MS);
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 300): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const strArray = (v: unknown, max = 8): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 50).slice(0, max) : [];

/** Returns the URL only if it is http(s) and (optionally) on one of the allowed hosts. */
export function safeUrl(value: unknown, allowedHosts?: string[]): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (allowedHosts && !allowedHosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function ageDays(createdAt: string | null, now: number): number | null {
  if (!createdAt) return null;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return null;
  return Math.max((now - created) / DAY_MS, 0.25); // floor at 6h so brand-new items don't explode
}

/** Star-farming signal: lots of stars, essentially no forks. A heuristic, so we down-rank instead of hiding. */
export function isLowEngagement(stars: number, forks: number): boolean {
  return stars >= 50 && forks / stars < 0.01;
}

/** Hacker-News-style gravity: rewards momentum, decays with age. */
export function trendScore(metric: number, age: number | null, lowEngagement = false): number {
  const base = age === null ? metric : metric / Math.pow(age + 2, 1.2);
  return lowEngagement ? base * 0.25 : base;
}

export function normalizeGithubRepo(raw: unknown, now: number = Date.now()): DiscoverItem | null {
  if (!isObj(raw)) return null;
  const fullName = str(raw.full_name, 140);
  const url = safeUrl(raw.html_url, ["github.com"]);
  if (!fullName || !url || raw.fork === true || raw.archived === true) return null;
  // GitHub reports size in KB. Near-empty repos with stars are almost always spam or placeholders.
  if (typeof raw.size === "number" && raw.size < MIN_REPO_KB) return null;

  const owner = isObj(raw.owner) ? raw.owner : {};
  const license = isObj(raw.license) ? str(raw.license.spdx_id, 40) : null;
  const stars = num(raw.stargazers_count);
  const forks = num(raw.forks_count);
  const createdAt = str(raw.created_at, 40);
  const age = ageDays(createdAt, now);
  const low = isLowEngagement(stars, forks);

  return {
    id: `github:${fullName.toLowerCase()}`,
    source: "github",
    title: fullName,
    url,
    description: str(raw.description, 280),
    author: str(owner.login, 60),
    avatarUrl: safeUrl(owner.avatar_url, ["avatars.githubusercontent.com"]),
    tag: str(raw.language, 30),
    topics: strArray(raw.topics, 6),
    metric: stars,
    metricLabel: "stars",
    secondary: forks,
    secondaryLabel: "forks",
    createdAt,
    perDay: age === null ? null : stars / age,
    score: trendScore(stars, age, low),
    lowEngagement: low,
    homepage: safeUrl(raw.homepage),
    license: license === "NOASSERTION" ? null : license,
  };
}

export function normalizeHuggingFace(raw: unknown, kind: "model" | "space", now: number = Date.now()): DiscoverItem | null {
  if (!isObj(raw)) return null;
  const repoId = str(raw.id, 140);
  if (!repoId || !/^[\w.-]+\/[\w.-]+$/.test(repoId)) return null;
  const url = safeUrl(`https://huggingface.co/${kind === "space" ? "spaces/" : ""}${repoId}`, ["huggingface.co"]);
  if (!url) return null;
  const likes = num(raw.likes);
  const createdAt = str(raw.createdAt, 40);
  const age = ageDays(createdAt, now);
  // Hugging Face computes its own trending score; prefer it when present.
  const hfScore = num(raw.trendingScore);

  return {
    id: `huggingface:${kind}:${repoId.toLowerCase()}`,
    source: "huggingface",
    title: repoId,
    url,
    description: null,
    author: repoId.split("/")[0] ?? null,
    avatarUrl: null,
    tag: kind === "model" ? str(raw.pipeline_tag, 40) : str(raw.sdk, 20),
    topics: strArray(raw.tags, 20).filter((t) => !t.includes(":")).slice(0, 4),
    metric: likes,
    metricLabel: "likes",
    secondary: kind === "model" ? num(raw.downloads) : null,
    secondaryLabel: kind === "model" ? "downloads" : null,
    createdAt,
    perDay: age === null ? null : likes / age,
    score: hfScore > 0 ? hfScore : trendScore(likes, age),
    lowEngagement: false,
    homepage: null,
    license: null,
  };
}

const AI_TITLE = /\b(ai|llms?|gpt|agents?|agentic|claude|gemini|mcp|rag|models?|ml|copilot|embeddings?|inference|prompts?)\b/i;

export function normalizeHackerNewsHit(raw: unknown, now: number = Date.now()): DiscoverItem | null {
  if (!isObj(raw)) return null;
  const objectId = str(raw.objectID, 20);
  const title = str(raw.title, 200);
  if (!objectId || !/^\d+$/.test(objectId) || !title || !AI_TITLE.test(title)) return null;
  const discussion = `https://news.ycombinator.com/item?id=${objectId}`;
  const url = safeUrl(raw.url) ?? discussion;
  const points = num(raw.points);
  const createdAt = str(raw.created_at, 40);
  const age = ageDays(createdAt, now);
  let domain: string | null = null;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = null;
  }

  return {
    id: `hackernews:${objectId}`,
    source: "hackernews",
    title: title.replace(/^Show HN:\s*/i, ""),
    url,
    description: null,
    author: str(raw.author, 60),
    avatarUrl: null,
    tag: domain,
    topics: [],
    metric: points,
    metricLabel: "points",
    secondary: num(raw.num_comments),
    secondaryLabel: "comments",
    createdAt,
    perDay: age === null ? null : points / age,
    score: trendScore(points, age),
    lowEngagement: false,
    homepage: discussion,
    license: null,
  };
}

/**
 * Moderation blocklist: "owner" blocks every repo of that owner, "owner/repo" one repo.
 * Parsed from the DISCOVER_BLOCKLIST env var (comma separated, case-insensitive).
 */
export function parseBlocklist(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function isBlocked(item: DiscoverItem, blocklist: Set<string>): boolean {
  if (blocklist.size === 0) return false;
  const name = item.title.toLowerCase();
  const owner = (item.author ?? name.split("/")[0] ?? "").toLowerCase();
  return blocklist.has(name) || blocklist.has(owner);
}

/** Dedupe by id, drop blocked items and those below the noise floor, sort by score. */
export function rankItems(
  items: Array<DiscoverItem | null>,
  { limit = 24, minMetric = 0, blocklist = new Set<string>() }: { limit?: number; minMetric?: number; blocklist?: Set<string> } = {},
): DiscoverItem[] {
  const seen = new Set<string>();
  const unique: DiscoverItem[] = [];
  for (const item of items) {
    if (!item || item.metric < minMetric || seen.has(item.id) || isBlocked(item, blocklist)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** "agent-autoloop" -> "Agent Autoloop", used to prefill the publish form. */
export function humanizeRepoName(fullName: string): string {
  const name = fullName.split("/").pop() ?? fullName;
  return name
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 80);
}
