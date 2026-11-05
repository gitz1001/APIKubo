/**
 * Domain rules shared by forms (for fast feedback) and API routes (for enforcement).
 * The database repeats the critical ones as CHECK constraints — never rely on the client.
 * Dependency-free so it can be unit tested with `node --test`.
 */
import type { ListingStatus, ListingType } from "./types";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
export const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;

export const LISTING_TYPES: ReadonlyArray<{ id: ListingType; label: string }> = [
  { id: "api", label: "API" },
  { id: "ai_skill", label: "AI Skill" },
];

export const CATEGORIES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "ai", label: "AI & Agents" },
  { id: "data", label: "Data & Enrichment" },
  { id: "finance", label: "Finance" },
  { id: "devtools", label: "Developer Tools" },
  { id: "security", label: "Security" },
  { id: "documents", label: "Documents & Vision" },
  { id: "geo", label: "Weather & Geo" },
  { id: "general", label: "General" },
];

export const LIMITS = {
  nameMax: 80,
  taglineMax: 140,
  descriptionMax: 5000,
  keyNameMax: 64,
  rpmMax: 10_000,
  quotaMax: 10_000_000,
} as const;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export interface ListingInput {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  type: ListingType;
  category: string;
  base_url: string;
  documentation_url: string | null;
  status: Extract<ListingStatus, "draft" | "published">;
  free_plan: { rate_limit_rpm: number; quota_monthly: number };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

/** Only allow same-site relative redirects ("/dashboard"), never "//evil.com" or "https://…". */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

const PRIVATE_HOST_RE =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1?\])$/i;

export function checkPublicHttpsUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a full URL, e.g. https://api.example.com/v1";
  }
  if (url.protocol !== "https:") return "Must use https://";
  if (url.username || url.password) return "URL must not contain credentials";
  if (PRIVATE_HOST_RE.test(url.hostname)) return "Must be a public host (the gateway blocks private networks)";
  if (url.search || url.hash) return "Base URL must not include a query string or fragment";
  return null;
}

function str(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
}

function int(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(parsed) ? parsed : NaN;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateListingInput(raw: unknown): ValidationResult<ListingInput> {
  if (!isRecord(raw)) return { ok: false, errors: { form: "Invalid request body" } };
  const errors: Record<string, string> = {};

  const name = str(raw, "name");
  if (name.length < 3 || name.length > LIMITS.nameMax) errors.name = `Name must be 3–${LIMITS.nameMax} characters`;

  const slug = str(raw, "slug").toLowerCase();
  if (!SLUG_RE.test(slug)) errors.slug = "3–50 chars: lowercase letters, numbers and dashes (no leading/trailing dash)";

  const tagline = str(raw, "tagline");
  if (tagline.length > LIMITS.taglineMax) errors.tagline = `Keep it under ${LIMITS.taglineMax} characters`;

  const description = str(raw, "description");
  if (description.length > LIMITS.descriptionMax) errors.description = `Keep it under ${LIMITS.descriptionMax} characters`;

  const type = str(raw, "type");
  if (!LISTING_TYPES.some((t) => t.id === type)) errors.type = "Choose API or AI Skill";

  const category = str(raw, "category");
  if (!CATEGORIES.some((c) => c.id === category)) errors.category = "Choose a category";

  const baseUrl = str(raw, "base_url").replace(/\/+$/, "");
  const baseUrlError = checkPublicHttpsUrl(baseUrl);
  if (baseUrlError) errors.base_url = baseUrlError;

  const docsUrl = str(raw, "documentation_url");
  if (docsUrl) {
    try {
      const parsed = new URL(docsUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") errors.documentation_url = "Must be an http(s) URL";
    } catch {
      errors.documentation_url = "Enter a full URL";
    }
  }

  const status = str(raw, "status") || "draft";
  if (status !== "draft" && status !== "published") errors.status = "Invalid status";

  const plan = isRecord(raw.free_plan) ? raw.free_plan : {};
  const rpm = int(plan, "rate_limit_rpm");
  const quota = int(plan, "quota_monthly");
  if (!(rpm >= 1 && rpm <= LIMITS.rpmMax)) errors.rate_limit_rpm = `1–${LIMITS.rpmMax.toLocaleString()} requests/minute`;
  if (!(quota >= 1 && quota <= LIMITS.quotaMax)) errors.quota_monthly = `1–${LIMITS.quotaMax.toLocaleString()} requests/month`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      slug,
      tagline: tagline || null,
      description: description || null,
      type: type as ListingType,
      category,
      base_url: baseUrl,
      documentation_url: docsUrl || null,
      status: status as "draft" | "published",
      free_plan: { rate_limit_rpm: rpm, quota_monthly: quota },
    },
  };
}

export function validateKeyName(raw: unknown): ValidationResult<string> {
  const name = isRecord(raw) && typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 1 || name.length > LIMITS.keyNameMax) {
    return { ok: false, errors: { name: `Name must be 1–${LIMITS.keyNameMax} characters` } };
  }
  return { ok: true, value: name };
}

export function validateHandle(raw: string): ValidationResult<string> {
  const handle = raw.trim().toLowerCase();
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, errors: { handle: "3–30 characters: lowercase letters, numbers, - or _" } };
  }
  if (handle.startsWith("user_")) {
    return { ok: false, errors: { handle: "Handles starting with user_ are reserved" } };
  }
  return { ok: true, value: handle };
}
