export type ListingType = "api" | "ai_skill";
export type ListingStatus = "draft" | "published" | "archived";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export interface Plan {
  id: string;
  listing_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  rate_limit_rpm: number;
  quota_monthly: number;
  features: string[];
  is_active: boolean;
}

export interface ProviderSummary {
  username: string;
  display_name: string | null;
}

export interface Listing {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  type: ListingType;
  status: ListingStatus;
  category: string;
  documentation_url: string | null;
  upvote_count: number;
  created_at: string;
  updated_at: string;
  provider: ProviderSummary | null;
  plans: Plan[];
}

/** Owner-only view: includes the upstream URL that consumers must never see. */
export interface OwnedListing extends Listing {
  base_url: string | null;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface SubscriptionSummary {
  id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  created_at: string;
  listing: { id: string; slug: string; name: string } | null;
  plan: {
    id: string;
    name: string;
    price_cents: number;
    rate_limit_rpm: number;
    quota_monthly: number;
  } | null;
}

export interface UsageSummary {
  requests: number;
  errors: number;
}

export interface SessionUser {
  id: string;
  email: string | null;
}
