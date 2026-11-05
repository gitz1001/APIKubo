-- ==============================================================================
-- APIKUBO — Migration 002_security_hardening.sql
--
-- Closes privilege gaps in 001 and adds the RPCs the web app and gateway use.
--   * api_keys:      clients could INSERT/UPDATE rows directly, attach a key to
--                    another user's subscription_id, or un-revoke a key.
--   * subscriptions: clients could INSERT an 'active' row for a PAID plan, or
--                    UPDATE plan_id/status freely, bypassing payment.
--   * listings:      owners could UPDATE upvote_count (fake popularity) and slug
--                    (breaking every consumer's gateway URL).
--   * profiles:      no handle format rule; user_id-derived defaults only.
-- All NOT VALID constraints apply to new writes without failing on legacy rows.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Defence in depth: anon never writes anything
-- ------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON
  public.profiles, public.listings, public.plans, public.subscriptions,
  public.api_keys, public.usage_rollups_hourly, public.upvotes
FROM anon;

-- ------------------------------------------------------------------------------
-- 1. Profiles
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9_-]{3,30}$') NOT VALID;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (username, display_name, avatar_url, bio) ON public.profiles TO authenticated;

-- Defaults always satisfy the handle rule; the user picks a real handle on first login.
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
    'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8),
    left(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',
                  split_part(COALESCE(NEW.email, 'builder@apikubo.internal'), '@', 1)), 80),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Listings: slug is immutable, upvote_count is trigger-owned
-- ------------------------------------------------------------------------------
ALTER TABLE public.listings
  ADD CONSTRAINT listings_slug_format
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$') NOT VALID;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_base_url_https
  CHECK (base_url IS NULL OR base_url ~ '^https://[^/@\s]+') NOT VALID;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_published_requires_base_url
  CHECK (status <> 'published' OR base_url IS NOT NULL) NOT VALID;

REVOKE INSERT, UPDATE ON public.listings FROM authenticated;
GRANT INSERT (user_id, name, slug, tagline, description, type, status, category,
              base_url, documentation_url, openapi_spec)
  ON public.listings TO authenticated;
GRANT UPDATE (name, tagline, description, type, status, category,
              base_url, documentation_url, openapi_spec)
  ON public.listings TO authenticated;

-- base_url is the provider's real upstream. If consumers can read it they can skip
-- the gateway (and metering). Hide it from API roles; owners use the RPC below.
REVOKE SELECT ON public.listings FROM anon, authenticated;
GRANT SELECT (id, user_id, name, slug, tagline, description, type, status, category,
              documentation_url, openapi_spec, upvote_count, created_at, updated_at)
  ON public.listings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_listing_endpoints()
RETURNS TABLE (listing_id uuid, base_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, base_url FROM public.listings WHERE user_id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 3. Plans: sane limits
-- ------------------------------------------------------------------------------
ALTER TABLE public.plans
  ADD CONSTRAINT plans_limits_valid
  CHECK (price_cents >= 0 AND rate_limit_rpm BETWEEN 1 AND 100000 AND quota_monthly >= 1) NOT VALID;

-- ------------------------------------------------------------------------------
-- 4. Subscriptions: no direct client writes. Free plans via RPC; paid plans will
--    be created server-side by the billing webhook (service role).
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;

CREATE OR REPLACE FUNCTION public.subscribe_to_free_plan(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_listing_id uuid;
  v_price integer;
  v_subscription_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT p.listing_id, p.price_cents INTO v_listing_id, v_price
  FROM public.plans p
  JOIN public.listings l ON l.id = p.listing_id
  WHERE p.id = p_plan_id AND p.is_active AND l.status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_price <> 0 THEN
    RAISE EXCEPTION 'paid_plan_requires_checkout' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.subscriptions (user_id, listing_id, plan_id, status, current_period_start, current_period_end)
  VALUES (v_uid, v_listing_id, p_plan_id, 'active', now(), NULL)
  ON CONFLICT (user_id, listing_id) DO UPDATE
    SET plan_id = EXCLUDED.plan_id,
        status = 'active',
        current_period_start = now(),
        current_period_end = NULL
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_subscription(p_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'canceled', current_period_end = now()
  WHERE id = p_subscription_id AND user_id = auth.uid() AND status <> 'canceled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. API keys: created/revoked only through RPCs. The web server generates the
--    secret and sends only (prefix, sha256 hash); the plaintext is never stored.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON public.api_keys;
REVOKE INSERT, UPDATE ON public.api_keys FROM authenticated;

CREATE OR REPLACE FUNCTION public.create_api_key(p_name text, p_key_prefix text, p_key_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_active integer;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;
  IF p_key_prefix !~ '^kubo_(live|test)_[A-Za-z0-9_-]{4,12}$' OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_key_material' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_active FROM public.api_keys WHERE user_id = v_uid AND revoked_at IS NULL;
  IF v_active >= 10 THEN
    RAISE EXCEPTION 'key_limit_reached' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.api_keys (user_id, subscription_id, name, key_prefix, key_hash)
  VALUES (v_uid, NULL, btrim(p_name), p_key_prefix, p_key_hash)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.api_keys
  SET revoked_at = now()
  WHERE id = p_key_id AND user_id = auth.uid() AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'key_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Usage metering (gateway / service role only): one atomic call per request
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_usage(
  p_api_key_id uuid,
  p_listing_id uuid,
  p_user_id uuid,
  p_endpoint text,
  p_status_code integer,
  p_response_time_ms integer,
  p_bytes bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO public.usage_events
    (api_key_id, listing_id, user_id, endpoint, status_code, response_time_ms, bytes_transferred)
  VALUES
    (p_api_key_id, p_listing_id, p_user_id, left(p_endpoint, 512), p_status_code, p_response_time_ms, p_bytes);

  -- total_errors counts provider failures (5xx); consumer 4xx are not the provider's fault.
  INSERT INTO public.usage_rollups_hourly
    (listing_id, user_id, hourly_bucket, total_requests, total_errors, total_latency_ms, total_bytes)
  VALUES
    (p_listing_id, p_user_id, v_bucket, 1, CASE WHEN p_status_code >= 500 THEN 1 ELSE 0 END,
     p_response_time_ms, p_bytes)
  ON CONFLICT (listing_id, user_id, hourly_bucket) DO UPDATE
    SET total_requests   = usage_rollups_hourly.total_requests + 1,
        total_errors     = usage_rollups_hourly.total_errors + EXCLUDED.total_errors,
        total_latency_ms = usage_rollups_hourly.total_latency_ms + EXCLUDED.total_latency_ms,
        total_bytes      = usage_rollups_hourly.total_bytes + EXCLUDED.total_bytes;

  -- Throttled so hot keys don't rewrite their row on every request.
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE id = p_api_key_id
    AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute');
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Function privileges (Postgres grants EXECUTE to PUBLIC by default)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.subscribe_to_free_plan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_api_key(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_listing_endpoints() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_usage(uuid, uuid, uuid, text, integer, integer, bigint)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.subscribe_to_free_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_api_key(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_listing_endpoints() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage(uuid, uuid, uuid, text, integer, integer, bigint) TO service_role;

-- Trigger functions must not be callable as RPCs.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_upvote_count_sync() FROM PUBLIC, anon, authenticated;
