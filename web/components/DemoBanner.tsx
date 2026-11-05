import { isSupabaseConfigured } from "@/lib/env";

/** Makes it obvious when the UI is running on seeded demo data instead of Supabase. */
export function DemoBanner() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="border-b border-highlight/20 bg-highlight-soft px-4 py-2 text-center text-xs text-highlight">
      <strong className="font-semibold">Demo mode:</strong> showing sample listings with in-memory storage. Add Supabase
      credentials to <code className="font-mono">web/.env.local</code> to go live.
    </div>
  );
}
