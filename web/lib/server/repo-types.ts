import type {
  ApiKeySummary,
  Listing,
  ListingStatus,
  OwnedListing,
  SubscriptionSummary,
  UsageSummary,
} from "@/lib/types";
import type { ListingInput } from "@/lib/validation";

export type RepoErrorCode = "not_found" | "conflict" | "forbidden" | "invalid" | "limit" | "unavailable";

export class RepoError extends Error {
  constructor(
    readonly code: RepoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RepoError";
  }
}

/**
 * Data access used by pages and route handlers. Every method that takes a userId
 * must scope to that user; the Supabase implementation additionally relies on RLS.
 */
export interface Repo {
  readonly mode: "supabase" | "demo";
  listPublished(): Promise<Listing[]>;
  /** Published listings for everyone; drafts/archived only for their owner. */
  getBySlug(slug: string): Promise<Listing | null>;
  getOwnedBySlug(userId: string, slug: string): Promise<OwnedListing | null>;
  listOwned(userId: string): Promise<OwnedListing[]>;
  createListing(userId: string, input: ListingInput): Promise<Listing>;
  setListingStatus(userId: string, listingId: string, status: ListingStatus): Promise<void>;

  listKeys(userId: string): Promise<ApiKeySummary[]>;
  createKey(userId: string, name: string, prefix: string, hash: string): Promise<ApiKeySummary>;
  revokeKey(userId: string, keyId: string): Promise<void>;

  listSubscriptions(userId: string): Promise<SubscriptionSummary[]>;
  subscribeFree(userId: string, planId: string): Promise<void>;
  cancelSubscription(userId: string, subscriptionId: string): Promise<void>;

  /** Requests per listing for the current UTC calendar month. */
  usageThisMonth(userId: string): Promise<Record<string, UsageSummary>>;
}
