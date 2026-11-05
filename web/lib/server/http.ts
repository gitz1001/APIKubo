import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/types";
import { getSessionUser } from "./auth";
import { RepoError, type RepoErrorCode } from "./repo-types";

const STATUS: Record<RepoErrorCode, number> = {
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  invalid: 422,
  limit: 429,
  unavailable: 503,
};

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(status: number, code: string, message: string, fields?: Record<string, string>): NextResponse {
  return json({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof RepoError) return apiError(STATUS[error.code], error.code, error.message);
  console.error("[api] unexpected error", error);
  return apiError(500, "internal", "Something went wrong");
}

/**
 * CSRF defence for cookie-authenticated mutations: the browser's Origin must match
 * this host, and bodies must be JSON (which cross-site forms cannot send without CORS).
 */
export function rejectCrossSite(request: Request, { requireJson }: { requireJson: boolean }): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0]?.trim();
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!host || originHost !== host) return apiError(403, "cross_site", "Cross-site request rejected");
  }
  if (requireJson && !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return apiError(415, "unsupported_media_type", "Send JSON with Content-Type: application/json");
  }
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  return user ?? apiError(401, "unauthenticated", "Sign in to continue");
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
