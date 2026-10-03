-- ==============================================================================
-- APIKUBO — Migration 001_init.sql
-- PostgreSQL / Supabase Initial Schema
-- ==============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure auth schema exists (standard in Supabase environments)
CREATE SCHEMA IF NOT EXISTS auth;

-- ==============================================================================
-- 1. Custom Enum Types
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_type') THEN
    CREATE TYPE public.listing_type AS ENUM ('api', 'ai_skill');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE public.listing_status AS ENUM ('draft', 'published', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
  END IF;
END $$;

-- ==============================================================================
-- 2. Tables Definition
-- ==============================================================================

-- 2.1 Profiles (linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Listings (APIs & AI Skills)
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  description TEXT,
  type public.listing_type NOT NULL DEFAULT 'api',
  status public.listing_status NOT NULL DEFAULT 'draft',
  category TEXT NOT NULL DEFAULT 'general',
  base_url TEXT,
  documentation_url TEXT,
  openapi_spec JSONB,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 Plans (Tiering and rate limits for listings)
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  quota_monthly INTEGER NOT NULL DEFAULT 1000,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 Subscriptions (User subscriptions to listing plans)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_user_listing_subscription UNIQUE(user_id, listing_id)
);

-- 2.5 API Keys (Gateway credentials, key_hash never accessible to clients)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Default API Key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 Usage Events (Raw gateway invocation telemetry — service role write-only)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  bytes_transferred BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 Usage Rollups Hourly (Aggregated analytics for providers and consumers)
CREATE TABLE IF NOT EXISTS public.usage_rollups_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  hourly_bucket TIMESTAMPTZ NOT NULL,
  total_requests BIGINT NOT NULL DEFAULT 0,
  total_errors BIGINT NOT NULL DEFAULT 0,
  total_latency_ms BIGINT NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_listing_user_hourly UNIQUE(listing_id, user_id, hourly_bucket)
);

-- 2.8 Upvotes (User endorsements for listings)
CREATE TABLE IF NOT EXISTS public.upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_user_listing_upvote UNIQUE(user_id, listing_id)
);

-- ==============================================================================
-- 3. Indexes
-- ==============================================================================

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_slug ON public.listings(slug);
CREATE INDEX IF NOT EXISTS idx_listings_status_category ON public.listings(status, category);
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON public.listings(user_id);

-- API Keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- Usage Events indexes
CREATE INDEX IF NOT EXISTS idx_usage_events_listing_created ON public.usage_events(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_api_key ON public.usage_events(api_key_id);

-- Plans, Subscriptions, Upvotes, Rollups indexes
CREATE INDEX IF NOT EXISTS idx_plans_listing_id ON public.plans(listing_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_listing_id ON public.subscriptions(listing_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_listing_id ON public.upvotes(listing_id);
CREATE INDEX IF NOT EXISTS idx_usage_rollups_hourly_lookup ON public.usage_rollups_hourly(listing_id, hourly_bucket DESC);

-- ==============================================================================
-- 4. Triggers & Functions
-- ==============================================================================

-- 4.1 Generic updated_at timestamp refresher
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_listings_updated_at ON public.listings;
CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_plans_updated_at ON public.plans;
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_usage_rollups_updated_at ON public.usage_rollups_hourly;
CREATE TRIGGER trg_usage_rollups_updated_at
  BEFORE UPDATE ON public.usage_rollups_hourly
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4.2 Auto-create profiles row on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, 'user@apikubo.internal'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.3 Synchronize listings.upvote_count on upvotes INSERT/DELETE
CREATE OR REPLACE FUNCTION public.handle_upvote_count_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.listings
    SET upvote_count = upvote_count + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.listing_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.listings
    SET upvote_count = GREATEST(0, upvote_count - 1),
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.listing_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_upvote_change ON public.upvotes;
CREATE TRIGGER on_upvote_change
  AFTER INSERT OR DELETE ON public.upvotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_upvote_count_sync();

-- ==============================================================================
-- 5. Safe Client Views & Column Security (Key Hash Isolation)
-- ==============================================================================

-- Secure view for user-facing API key management (EXCLUDES key_hash entirely)
CREATE OR REPLACE VIEW public.user_api_keys
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  subscription_id,
  name,
  key_prefix,
  last_used_at,
  revoked_at,
  expires_at,
  created_at,
  updated_at
FROM public.api_keys;

-- Grant access on the view to authenticated users
GRANT SELECT ON public.user_api_keys TO authenticated;

-- Revoke whole-table SELECT from public, anon, and authenticated on api_keys
REVOKE SELECT ON public.api_keys FROM public, anon, authenticated;

-- Grant selective column SELECT on api_keys to authenticated (NEVER grants select on key_hash)
GRANT SELECT (
  id,
  user_id,
  subscription_id,
  name,
  key_prefix,
  last_used_at,
  revoked_at,
  expires_at,
  created_at,
  updated_at
) ON public.api_keys TO authenticated;

-- Allow insert/update/delete by authenticated users subject to RLS
GRANT INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;

-- Revoke all direct client operations on raw usage_events (only service role writes/reads)
REVOKE ALL ON public.usage_events FROM public, anon, authenticated;

-- ==============================================================================
-- 6. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_rollups_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upvotes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 6.1 Profiles Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 6.2 Listings Policies
-- ------------------------------------------------------------------------------
-- Anyone can view published listings
CREATE POLICY "Published listings are viewable by everyone"
  ON public.listings
  FOR SELECT
  USING (status = 'published');

-- Owners can view own listings (drafts, published, archived)
CREATE POLICY "Owners can view own listings in any state"
  ON public.listings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owners can create own listings
CREATE POLICY "Owners can create own listings"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owners can update own listings
CREATE POLICY "Owners can update own listings"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owners can delete own listings
CREATE POLICY "Owners can delete own listings"
  ON public.listings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6.3 Plans Policies
-- ------------------------------------------------------------------------------
-- Plans readable by anyone if parent listing is published
CREATE POLICY "Plans of published listings are viewable by everyone"
  ON public.plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = plans.listing_id
        AND l.status = 'published'
    )
  );

-- Listing owners can view plans for their own listings in any state
CREATE POLICY "Listing owners can view plans of own listings"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = plans.listing_id
        AND l.user_id = auth.uid()
    )
  );

-- Listing owners can create plans for their own listings
CREATE POLICY "Listing owners can insert plans for own listings"
  ON public.plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = plans.listing_id
        AND l.user_id = auth.uid()
    )
  );

-- Listing owners can update plans for their own listings
CREATE POLICY "Listing owners can update plans for own listings"
  ON public.plans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = plans.listing_id
        AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = plans.listing_id
        AND l.user_id = auth.uid()
    )
  );

-- Listing owners can delete plans for their own listings
CREATE POLICY "Listing owners can delete plans for own listings"
  ON public.plans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = plans.listing_id
        AND l.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 6.4 Subscriptions Policies
-- ------------------------------------------------------------------------------
-- Users can only view their own subscriptions
CREATE POLICY "Users can view only their own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can subscribe to a listing plan
CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can modify/cancel own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6.5 API Keys Policies
-- ------------------------------------------------------------------------------
-- Users can read only their own API keys
CREATE POLICY "Users can view only their own api keys"
  ON public.api_keys
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can generate their own API keys
CREATE POLICY "Users can create own api keys"
  ON public.api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update/revoke their own API keys
CREATE POLICY "Users can update own api keys"
  ON public.api_keys
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own api keys"
  ON public.api_keys
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6.6 Usage Events Policies
-- ------------------------------------------------------------------------------
-- RLS is enabled with ZERO policies for anon or authenticated.
-- Only the gateway running with the service_role key (which bypasses RLS) can read/write.
-- No client has any read or write access.

-- ------------------------------------------------------------------------------
-- 6.7 Usage Rollups Hourly Policies
-- ------------------------------------------------------------------------------
-- Consumers can view their own consumption metrics
CREATE POLICY "Consumers can view their own usage rollups"
  ON public.usage_rollups_hourly
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Providers can view metrics for listings they own
CREATE POLICY "Providers can view usage rollups for their listings"
  ON public.usage_rollups_hourly
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = usage_rollups_hourly.listing_id
        AND l.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 6.8 Upvotes Policies
-- ------------------------------------------------------------------------------
-- Anyone can read upvotes to view endorsement counts and listings
CREATE POLICY "Upvotes are viewable by everyone"
  ON public.upvotes
  FOR SELECT
  USING (true);

-- Authenticated users can cast an upvote as themselves
CREATE POLICY "Users can insert own upvotes"
  ON public.upvotes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can remove their own upvote
CREATE POLICY "Users can delete own upvotes"
  ON public.upvotes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
