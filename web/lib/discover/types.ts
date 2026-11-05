export type DiscoverSource = "github" | "huggingface" | "hackernews";
export type DiscoverWindow = "week" | "month";
export type FeedId = "agents" | "mcp" | "skills" | "llm-tools" | "models" | "spaces" | "launches";

export interface DiscoverItem {
  /** Stable across fetches, e.g. "github:owner/repo". */
  id: string;
  source: DiscoverSource;
  title: string;
  /** Always an http(s) URL on the expected host for the source. */
  url: string;
  description: string | null;
  author: string | null;
  avatarUrl: string | null;
  /** Language (GitHub), pipeline/SDK (Hugging Face) or domain (Hacker News). */
  tag: string | null;
  topics: string[];
  metric: number;
  metricLabel: "stars" | "likes" | "points";
  secondary: number | null;
  secondaryLabel: "forks" | "downloads" | "comments" | null;
  createdAt: string | null;
  /** Primary metric per day since creation; null when the source has no creation date. */
  perDay: number | null;
  score: number;
  /** Heuristic: many stars but almost no forks. Down-ranked, never labelled publicly. */
  lowEngagement: boolean;
  homepage: string | null;
  license: string | null;
}

export interface FeedResult {
  items: DiscoverItem[];
  fetchedAt: string;
  error: string | null;
}
