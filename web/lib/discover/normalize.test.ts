import assert from "node:assert/strict";
import { test } from "node:test";
import {
  humanizeRepoName,
  parseBlocklist,
  isLowEngagement,
  normalizeGithubRepo,
  normalizeHackerNewsHit,
  normalizeHuggingFace,
  rankItems,
  safeUrl,
  sinceDate,
} from "./normalize.ts";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function repo(overrides: Record<string, unknown> = {}) {
  return {
    full_name: "acme/agent-loop",
    html_url: "https://github.com/acme/agent-loop",
    description: "An agent loop",
    owner: { login: "acme", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4" },
    stargazers_count: 300,
    forks_count: 40,
    size: 512,
    language: "TypeScript",
    topics: ["ai-agents", "llm"],
    created_at: daysAgo(3),
    homepage: "https://acme.dev",
    license: { spdx_id: "MIT" },
    fork: false,
    archived: false,
    ...overrides,
  };
}

test("normalizeGithubRepo maps fields and computes velocity", () => {
  const item = normalizeGithubRepo(repo(), NOW);
  assert.ok(item);
  assert.equal(item.id, "github:acme/agent-loop");
  assert.equal(item.metric, 300);
  assert.equal(Math.round(item.perDay ?? 0), 100);
  assert.equal(item.license, "MIT");
  assert.equal(item.lowEngagement, false);
});

test("normalizeGithubRepo rejects forks, archives, malformed and off-host URLs", () => {
  assert.equal(normalizeGithubRepo(repo({ fork: true }), NOW), null);
  assert.equal(normalizeGithubRepo(repo({ archived: true }), NOW), null);
  assert.equal(normalizeGithubRepo(repo({ html_url: "javascript:alert(1)" }), NOW), null);
  assert.equal(normalizeGithubRepo(repo({ html_url: "https://evil.example/acme" }), NOW), null);
  assert.equal(normalizeGithubRepo("nope", NOW), null);
  const item = normalizeGithubRepo(repo({ owner: { login: "x", avatar_url: "https://tracker.example/p.gif" }, homepage: "javascript:x" }), NOW);
  assert.equal(item?.avatarUrl, null);
  assert.equal(item?.homepage, null);
});

test("low-engagement repos are down-ranked, not removed", () => {
  assert.ok(isLowEngagement(264, 1));
  assert.ok(!isLowEngagement(40, 0)); // too small to judge
  assert.ok(!isLowEngagement(1000, 120));
  const farmed = normalizeGithubRepo(repo({ full_name: "x/farmed", html_url: "https://github.com/x/farmed", stargazers_count: 500, forks_count: 0 }), NOW);
  const organic = normalizeGithubRepo(repo({ stargazers_count: 300, forks_count: 40 }), NOW);
  const ranked = rankItems([farmed, organic]);
  assert.deepEqual(ranked.map((i) => i.id), ["github:acme/agent-loop", "github:x/farmed"]);
});

test("ranking prefers momentum over raw totals and dedupes", () => {
  const fresh = normalizeGithubRepo(repo({ full_name: "a/fresh", html_url: "https://github.com/a/fresh", stargazers_count: 200, created_at: daysAgo(1) }), NOW);
  const old = normalizeGithubRepo(repo({ full_name: "a/old", html_url: "https://github.com/a/old", stargazers_count: 400, created_at: daysAgo(29) }), NOW);
  const ranked = rankItems([old, fresh, fresh, null], { minMetric: 5 });
  assert.deepEqual(ranked.map((i) => i.title), ["a/fresh", "a/old"]);
});

test("Hugging Face items use HF trending score and safe URLs", () => {
  const model = normalizeHuggingFace({ id: "org/model-7b", likes: 120, downloads: 5000, trendingScore: 88, pipeline_tag: "text-generation", tags: ["safetensors", "license:mit"], createdAt: daysAgo(4) }, "model", NOW);
  assert.equal(model?.url, "https://huggingface.co/org/model-7b");
  assert.equal(model?.score, 88);
  assert.deepEqual(model?.topics, ["safetensors"]);
  const space = normalizeHuggingFace({ id: "org/demo", likes: 9, sdk: "gradio" }, "space", NOW);
  assert.equal(space?.url, "https://huggingface.co/spaces/org/demo");
  assert.equal(normalizeHuggingFace({ id: "../../etc" }, "model", NOW), null);
});

test("Hacker News hits: AI-only, title cleaned, unsafe URLs fall back to the discussion", () => {
  const hit = normalizeHackerNewsHit({ objectID: "42", title: "Show HN: An open-source agent for SQL", url: "javascript:alert(1)", points: 80, num_comments: 12, created_at: daysAgo(2) }, NOW);
  assert.equal(hit?.title, "An open-source agent for SQL");
  assert.equal(hit?.url, "https://news.ycombinator.com/item?id=42");
  assert.equal(normalizeHackerNewsHit({ objectID: "43", title: "Show HN: My bread recipe app", points: 300 }, NOW), null);
});

test("helpers", () => {
  assert.equal(safeUrl("ftp://x.example"), null);
  assert.equal(safeUrl("https://u:p@x.example"), null);
  assert.equal(humanizeRepoName("acme/agent-auto_loop"), "Agent Auto Loop");
  assert.equal(sinceDate("week", NOW).toISOString().slice(0, 10), "2026-10-29");
});

test("near-empty repos are dropped (spam / placeholders)", () => {
  assert.equal(normalizeGithubRepo(repo({ size: 4 }), NOW), null);
  assert.ok(normalizeGithubRepo(repo({ size: 134 }), NOW));
  assert.ok(normalizeGithubRepo(repo({ size: undefined }), NOW)); // unknown size is not evidence
});

test("moderation blocklist by owner or exact repo", () => {
  const a = normalizeGithubRepo(repo(), NOW);
  const b = normalizeGithubRepo(repo({ full_name: "Spammer/x", html_url: "https://github.com/Spammer/x", owner: { login: "Spammer" } }), NOW);
  const c = normalizeGithubRepo(repo({ full_name: "ok/keep", html_url: "https://github.com/ok/keep", owner: { login: "ok" } }), NOW);
  const ranked = rankItems([a, b, c], { blocklist: parseBlocklist(" spammer , ACME/agent-loop ,") });
  assert.deepEqual(ranked.map((i) => i.title), ["ok/keep"]);
});
