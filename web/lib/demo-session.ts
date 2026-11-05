/**
 * Local demo session (no Supabase). The cookie is client-controlled, so it is only
 * honoured when isDemoAuthAllowed() — i.e. never in production builds.
 */
export interface DemoSession {
  id: string;
  email: string;
  full_name: string;
  username: string;
}

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export function parseDemoSession(raw: string | undefined): DemoSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id) return null;
    return {
      id: record.id,
      email: typeof record.email === "string" ? record.email : "builder@apikubo.dev",
      full_name: typeof record.full_name === "string" ? record.full_name : "Demo Builder",
      username: typeof record.username === "string" ? record.username : "user_demo",
    };
  } catch {
    return null;
  }
}

export function serializeDemoSession(session: DemoSession): string {
  return encodeURIComponent(JSON.stringify(session));
}
