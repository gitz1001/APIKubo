import { randomUUID } from "node:crypto";
import { buildSeedListings } from "@/lib/seed";
import type { ApiKeySummary, Listing, ListingStatus, OwnedListing, SubscriptionSummary, UsageSummary } from "@/lib/types";
import type { ListingInput } from "@/lib/validation";
import { RepoError, type Repo } from "./repo-types";

/**
 * In-memory implementation for local development without Supabase. Mirrors the
 * database rules (ownership, free-plan-only subscribe, 10 active keys) so the UI
 * behaves the same in both modes. State resets when the dev server restarts.
 */
interface StoredKey extends ApiKeySummary {
  user_id: string;
  key_hash: string;
}

interface StoredSubscription {
  id: string;
  user_id: string;
  listing_id: string;
  plan_id: string;
  status: SubscriptionSummary["status"];
  current_period_start: string;
  created_at: string;
}

interface DemoState {
  listings: OwnedListing[];
  keys: StoredKey[];
  subscriptions: StoredSubscription[];
}

const globalForDemo = globalThis as typeof globalThis & { __apikuboDemo?: DemoState };

function state(): DemoState {
  globalForDemo.__apikuboDemo ??= { listings: buildSeedListings(), keys: [], subscriptions: [] };
  return globalForDemo.__apikuboDemo;
}

function publicView(listing: OwnedListing): Listing {
  // Strip the upstream URL: consumers must go through the gateway.
  const { base_url: _hidden, ...rest } = listing;
  void _hidden;
  return structuredClone(rest);
}

const now = () => new Date().toISOString();

export function createDemoRepo(usernameFor: (userId: string) => string | null): Repo {
  return {
    mode: "demo",

    async listPublished() {
      return state()
        .listings.filter((l) => l.status === "published")
        .sort((a, b) => b.upvote_count - a.upvote_count || b.created_at.localeCompare(a.created_at))
        .map(publicView);
    },

    async getBySlug(slug) {
      const listing = state().listings.find((l) => l.slug === slug && l.status === "published");
      return listing ? publicView(listing) : null;
    },

    async getOwnedBySlug(userId, slug) {
      const listing = state().listings.find((l) => l.slug === slug && l.user_id === userId);
      return listing ? structuredClone(listing) : null;
    },

    async listOwned(userId) {
      return state()
        .listings.filter((l) => l.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((l) => structuredClone(l));
    },

    async createListing(userId, input: ListingInput) {
      const s = state();
      if (s.listings.some((l) => l.slug === input.slug)) throw new RepoError("conflict", "That slug is already taken");
      const id = randomUUID();
      const timestamp = now();
      const listing: OwnedListing = {
        id,
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
        upvote_count: 0,
        created_at: timestamp,
        updated_at: timestamp,
        provider: { username: usernameFor(userId) ?? "you", display_name: null },
        plans: [
          {
            id: randomUUID(),
            listing_id: id,
            name: "Free",
            description: null,
            price_cents: 0,
            rate_limit_rpm: input.free_plan.rate_limit_rpm,
            quota_monthly: input.free_plan.quota_monthly,
            features: [],
            is_active: true,
          },
        ],
      };
      s.listings.push(listing);
      return publicView(listing);
    },

    async setListingStatus(userId, listingId, status: ListingStatus) {
      const listing = state().listings.find((l) => l.id === listingId && l.user_id === userId);
      if (!listing) throw new RepoError("not_found", "Listing not found");
      if (status === "published" && !listing.base_url) throw new RepoError("invalid", "Add a base URL before publishing");
      listing.status = status;
      listing.updated_at = now();
    },

    async listKeys(userId) {
      return state()
        .keys.filter((k) => k.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ user_id: _u, key_hash: _h, ...summary }) => ({ ...summary }));
    },

    async createKey(userId, name, prefix, hash) {
      const s = state();
      if (s.keys.filter((k) => k.user_id === userId && !k.revoked_at).length >= 10) {
        throw new RepoError("limit", "You can have at most 10 active keys. Revoke one first.");
      }
      const key: StoredKey = {
        id: randomUUID(),
        user_id: userId,
        key_hash: hash,
        name,
        key_prefix: prefix,
        last_used_at: null,
        revoked_at: null,
        expires_at: null,
        created_at: now(),
      };
      s.keys.push(key);
      const { user_id: _u, key_hash: _h, ...summary } = key;
      return summary;
    },

    async revokeKey(userId, keyId) {
      const key = state().keys.find((k) => k.id === keyId && k.user_id === userId && !k.revoked_at);
      if (!key) throw new RepoError("not_found", "Key not found");
      key.revoked_at = now();
    },

    async listSubscriptions(userId) {
      const s = state();
      return s.subscriptions
        .filter((sub) => sub.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((sub) => {
          const listing = s.listings.find((l) => l.id === sub.listing_id);
          const plan = listing?.plans.find((p) => p.id === sub.plan_id);
          return {
            id: sub.id,
            status: sub.status,
            current_period_start: sub.current_period_start,
            created_at: sub.created_at,
            listing: listing ? { id: listing.id, slug: listing.slug, name: listing.name } : null,
            plan: plan
              ? { id: plan.id, name: plan.name, price_cents: plan.price_cents, rate_limit_rpm: plan.rate_limit_rpm, quota_monthly: plan.quota_monthly }
              : null,
          };
        });
    },

    async subscribeFree(userId, planId) {
      const s = state();
      const listing = s.listings.find((l) => l.status === "published" && l.plans.some((p) => p.id === planId && p.is_active));
      const plan = listing?.plans.find((p) => p.id === planId);
      if (!listing || !plan) throw new RepoError("not_found", "Plan not found");
      if (plan.price_cents !== 0) throw new RepoError("forbidden", "Paid plans require checkout (coming soon)");
      const existing = s.subscriptions.find((sub) => sub.user_id === userId && sub.listing_id === listing.id);
      if (existing) {
        Object.assign(existing, { plan_id: plan.id, status: "active", current_period_start: now() });
        return;
      }
      s.subscriptions.push({
        id: randomUUID(),
        user_id: userId,
        listing_id: listing.id,
        plan_id: plan.id,
        status: "active",
        current_period_start: now(),
        created_at: now(),
      });
    },

    async cancelSubscription(userId, subscriptionId) {
      const sub = state().subscriptions.find((x) => x.id === subscriptionId && x.user_id === userId && x.status !== "canceled");
      if (!sub) throw new RepoError("not_found", "Subscription not found");
      sub.status = "canceled";
    },

    async usageThisMonth(): Promise<Record<string, UsageSummary>> {
      return {}; // The demo has no gateway traffic to meter.
    },
  };
}
