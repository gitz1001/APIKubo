import type { DiscoverSource, FeedId } from "./types";

export interface FeedConfig {
  id: FeedId;
  label: string;
  blurb: string;
  source: DiscoverSource;
  /** GitHub: topic keywords matched with `OR … in:topics` (one API call per feed). */
  githubTopics?: string[];
  /** Whether the week/month window applies (Hugging Face uses its own trending score). */
  windowed: boolean;
}

export const FEEDS: FeedConfig[] = [
  {
    id: "agents",
    label: "AI Agents",
    blurb: "New autonomous and agentic projects gaining stars fastest.",
    source: "github",
    githubTopics: ["ai-agents", "ai-agent", "autonomous-agents", "agentic-ai"],
    windowed: true,
  },
  {
    id: "mcp",
    label: "MCP Servers",
    blurb: "Model Context Protocol servers that plug tools and data into AI clients.",
    source: "github",
    githubTopics: ["mcp-server", "model-context-protocol", "mcp-servers"],
    windowed: true,
  },
  {
    id: "skills",
    label: "Agent Skills",
    blurb: "Reusable skills and prompt packs for Claude and other coding agents.",
    source: "github",
    githubTopics: ["claude-skills", "agent-skills", "claude-code-skills"],
    windowed: true,
  },
  {
    id: "llm-tools",
    label: "LLM Tools",
    blurb: "Frameworks, RAG pipelines and LLMOps tooling.",
    source: "github",
    githubTopics: ["llm-tools", "rag", "llmops", "llm-framework"],
    windowed: true,
  },
  { id: "models", label: "Models", blurb: "What's trending on the Hugging Face Hub right now.", source: "huggingface", windowed: false },
  { id: "spaces", label: "Demos", blurb: "Trending Hugging Face Spaces: live demos you can try in the browser.", source: "huggingface", windowed: false },
  { id: "launches", label: "Launches", blurb: "AI projects posted to Show HN, ranked by points with time decay.", source: "hackernews", windowed: true },
];

export function getFeed(id: string | undefined): FeedConfig {
  return FEEDS.find((f) => f.id === id) ?? FEEDS[0];
}

export const SOURCE_LABEL: Record<DiscoverSource, string> = {
  github: "GitHub",
  huggingface: "Hugging Face",
  hackernews: "Hacker News",
};
