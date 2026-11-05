import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  ApiKeySummary,
  Listing,
  ListingStatus,
  OwnedListing,
  Plan,
  SubscriptionSummary,
  UsageSummary,
} from "@/lib/types";
import type { ListingInput } from "@/lib/validation";
import { RepoError, type Repo } from "./repo-types";

/**
 * Supabase implementation. Runs as the signed-in user, so RLS and the column grants
 * from migration 002 are the real enforcement layer; userId checks here are defence in depth.
 * base_url is not selectable by API roles — owners read it via get_my_listing_endpoints().
 */
const LISTING_COLUMNS =
  "id,user_id,name,slug,tagline,description,type,status,category,documentation_url,upvote_count,created_at,updated_at," +
  "provider:profiles(username,display_name)," +
  "plans(id,listing_id,name,description,price_cents,rate_limit_rpm,quota_monthly,features,is_active)";
const KEY_COLUMNS = "id,name,key_prefix,last_used_at,revoked_at,expires_at,created_at";

type ListingRow = Omit<Listing, "plans" | "provider"> & {
  provider: Listing["provider"] | Listing["provider"][];
  plans: Array<Omit<Plan, "features"> & { features: unknown }> | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  paid_plan_requires_checkout: "Paid plans require checkout (coming soon).",
  plan_not_found: "That plan is not available.",
  key_limit_reached: "You can have at most 10 active keys. Revoke one first.",
  key_not_found: "Key not found.",
  subscription_not_found: "Subscription not found.",
};

function fail(error: PostgrestError | null, fallback = "Request failed"): never {
  const known = error?.message ? ERROR_MESSAGES[error.message] : undefined;
  switch (error?.code) {
    case "23505":
      throw new RepoError("conflict", "That slug is already taken");
    case "23514":
    case "22023":
      throw new RepoError("invalid", known ?? "Some values were rejected by the database");
    case "42501":
      throw new RepoError("forbidden", known ?? "You do not have permission to do that");
    case "P0002":
      throw new RepoError("not_found", known ?? "Not found");
    case "54000":
      throw new RepoError("limit", known ?? "Limit reached");
    default:
      console.error("[supabase]", error);
      throw new RepoError("unavailable", fallback);
  }
}

function toListing(row: ListingRow): Listing {
  const provider = Array.isArray(row.provider) ? row.provider[0] ?? null : row.provider;
  const plans = (row.plans ?? [])
    .map((p) => ({ ...p, features: Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === "string") : [] }))
    .sort((a, b) => a.price_cents - b.price_cents);
  return { ...row, provider, plans };
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export function createSupabaseRepo(): Repo {
  const db = createClient();

  async function endpointsFor(userId: string): Promise<Map<string, string | null>> {
    const { data, error } = await db.rpc("get_my_listing_endpoints");
    if (error) fail(error);
    void userId; // scoped by auth.uid() inside the function
    const rows = (data ?? []) as Array<{ listing_id: string; base_url: string | null }>;
    return new Map(rows.map((r) => [r.listing_id, r.base_url]));
  }

  return {
    mode: "supabase",

    async listPublished() {
      const { data, error } = await db
        .from("listings")
        .select(LISTING_COLUMNS)
        .eq("status", "published")
        .order("upvote_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) fail(error, "Could not load the catalog");
      return ((data ?? []) as unknown as ListingRow[]).map(toListing);
    },

    async getBySlug(slug) {
      const { data, error } = await db.from("listings").select(LISTING_COLUMNS).eq("slug", slug).eq("status", "published").maybeSingle();
      if (error) fail(error);
      return data ? toListing(data as unknown as ListingRow) : null;
    },

    async getOwnedBySlug(userId, slug) {
      const { data, error } = await db.from("listings").select(LISTING_COLUMNS).eq("slug", slug).eq("user_id", userId).maybeSingle();
      if (error) fail(error);
      if (!data) return null;
      const endpoints = await endpointsFor(userId);
      const listing = toListing(data as unknown as ListingRow);
      return { ...listing, base_url: endpoints.get(listing.id) ?? null };
    },

    async listOwned(userId) {
      const [{ data, error }, endpoints] = await Promise.all([
        db.from("listings").select(LISTING_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }),
        endpointsFor(userId),
      ]);
      if (error) fail(error);
      return ((data ?? []) as unknown as ListingRow[]).map((row): OwnedListing => {
        const listing = toListing(row);
        return { ...listing, base_url: endpoints.get(listing.id) ?? null };
      });
    },

    async createListing(userId, input: ListingInput) {
      const { data: created, error } = await db
        .from("listings")
        .insert({
          user_id: userId,
          name: input.name,
          slug: input.slug,
          tagline: input.tagline,
          description: input.description,
          type: input.type,
          status: input.status,
          category: input.category,
          base_url: input.base_url,
          documentation_url: input.documentation_url,
        })
        .select("id")
        .single();
      if (error || !created) fail(error, "Could not create the listing");
      const listingId = (created as { id: string }).id;

      const { error: planError } = await db.from("plans").insert({
        listing_id: listingId,
        name: "Free",
        price_cents: 0,
        rate_limit_rpm: input.free_plan.rate_limit_rpm,
        quota_monthly: input.free_plan.quota_monthly,
        features: [],
      });
      if (planError) {
        await db.from("listings").delete().eq("id", listingId); // compensate: no plan-less listings
        fail(planError, "Could not create the free plan");
      }

      const { data, error: readError } = await db.from("listings").select(LISTING_COLUMNS).eq("id", listingId).single();
      if (readError || !data) fail(readError);
      return toListing(data as unknown as ListingRow);
    },

    async setListingStatus(userId, listingId, status: ListingStatus) {
      const { data, error } = await db.from("listings").update({ status }).eq("id", listingId).eq("user_id", userId).select("id");
      if (error) fail(error);
      if (!data || data.length === 0) throw new RepoError("not_found", "Listing not found");
    },

    async listKeys(userId) {
      const { data, error } = await db.from("user_api_keys").select(KEY_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false });
      if (error) fail(error);
      return (data ?? []) as ApiKeySummary[];
    },

    async createKey(userId, name, prefix, hash) {
      const { data: id, error } = await db.rpc("create_api_key", { p_name: name, p_key_prefix: prefix, p_key_hash: hash });
      if (error) fail(error, "Could not create the key");
      const { data, error: readError } = await db.from("user_api_keys").select(KEY_COLUMNS).eq("id", id as string).eq("user_id", userId).single();
      if (readError || !data) fail(readError);
      return data as ApiKeySummary;
    },

    async revokeKey(_userId, keyId) {
      const { error } = await db.rpc("revoke_api_key", { p_key_id: keyId });
      if (error) fail(error);
    },

    async listSubscriptions(userId) {
      const { data, error } = await db
        .from("subscriptions")
        .select(
          "id,status,current_period_start,created_at,listing:listings(id,slug,name),plan:plans(id,name,price_cents,rate_limit_rpm,quota_monthly)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) fail(error);
      type Row = Omit<SubscriptionSummary, "listing" | "plan"> & {
        listing: SubscriptionSummary["listing"] | SubscriptionSummary["listing"][];
        plan: SubscriptionSummary["plan"] | SubscriptionSummary["plan"][];
      };
      return ((data ?? []) as unknown as Row[]).map((row) => ({
        ...row,
        listing: Array.isArray(row.listing) ? row.listing[0] ?? null : row.listing,
        plan: Array.isArray(row.plan) ? row.plan[0] ?? null : row.plan,
      }));
    },

    async subscribeFree(_userId, planId) {
      const { error } = await db.rpc("subscribe_to_free_plan", { p_plan_id: planId });
      if (error) fail(error);
    },

    async cancelSubscription(_userId, subscriptionId) {
      const { error } = await db.rpc("cancel_subscription", { p_subscription_id: subscriptionId });
      if (error) fail(error);
    },

    async usageThisMonth(userId) {
      const { data, error } = await db
        .from("usage_rollups_hourly")
        .select("listing_id,total_requests,total_errors")
        .eq("user_id", userId)
        .gte("hourly_bucket", monthStartIso())
        .limit(10_000);
      if (error) fail(error);
      const totals: Record<string, UsageSummary> = {};
      for (const row of (data ?? []) as Array<{ listing_id: string; total_requests: number; total_errors: number }>) {
        const entry = (totals[row.listing_id] ??= { requests: 0, errors: 0 });
        entry.requests += Number(row.total_requests);
        entry.errors += Number(row.total_errors);
      }
      return totals;
    },
  };
}
