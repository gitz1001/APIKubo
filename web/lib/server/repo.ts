import { isSupabaseConfigured } from "@/lib/env";
import { getDemoUsername } from "./auth";
import { createDemoRepo } from "./repo-demo";
import type { Repo } from "./repo-types";
import { createSupabaseRepo } from "./repo-supabase";

export { RepoError, type Repo } from "./repo-types";

/** Create per request: the Supabase client is bound to this request's cookies. */
export function getRepo(): Repo {
  if (isSupabaseConfigured()) return createSupabaseRepo();
  return createDemoRepo(() => getDemoUsername());
}
