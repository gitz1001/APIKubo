"""FastAPI application: ``/health`` plus the metered proxy at ``/v1/{slug}/{path}``."""

from __future__ import annotations

import logging
import re
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from .config import Settings
from .keys import extract_api_key, hash_key, is_valid_slug, is_well_formed
from .models import UsageEvent
from .ratelimit import LimitDecision, LimiterUnavailable, MemoryRateLimiter, RateLimiter, RedisRateLimiter
from .store import MemoryStore, Store, StoreUnavailable, SupabaseStore
from .upstream import (
    Resolver,
    UpstreamBlocked,
    UpstreamUnresolvable,
    build_upstream_url,
    resolve_target,
    system_resolver,
)

logger = logging.getLogger("apikubo.gateway")

VERSION = "0.2.0"
PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

# Never forwarded upstream: hop-by-hop headers plus consumer credentials.
_STRIP_REQUEST_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
    "trailers", "transfer-encoding", "upgrade", "host", "content-length",
    "authorization", "x-api-key", "cookie", "forwarded", "x-forwarded-for",
    "x-forwarded-host", "x-forwarded-proto", "x-real-ip",
}
_STRIP_RESPONSE_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
    "trailers", "transfer-encoding", "upgrade", "content-length", "set-cookie",
}


@dataclass
class GatewayDeps:
    settings: Settings
    store: Store
    limiter: RateLimiter
    http: httpx.AsyncClient
    resolver: Resolver


def _error(status: int, code: str, message: str, request_id: str, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message}, "request_id": request_id},
        status_code=status,
        headers={"X-Request-Id": request_id, **(headers or {})},
    )


def _limit_headers(decision: LimitDecision) -> dict[str, str]:
    return {
        "X-RateLimit-Limit": str(decision.rpm_limit),
        "X-RateLimit-Remaining": str(decision.rpm_remaining),
        "X-RateLimit-Reset": str(decision.rpm_reset),
        "X-Quota-Limit": str(decision.quota_limit),
        "X-Quota-Remaining": str(decision.quota_remaining),
        "X-Quota-Reset": str(decision.quota_reset),
    }


def _default_store(settings: Settings) -> Store:
    if settings.use_supabase:
        assert settings.supabase_url and settings.supabase_service_role_key
        return SupabaseStore(settings.supabase_url, settings.supabase_service_role_key, cache_ttl_s=settings.cache_ttl_s)
    store = MemoryStore()
    if settings.dev_api_key:
        listing = store.add_listing("echo", settings.dev_upstream_url)
        record = store.add_key(settings.dev_api_key, user_id="dev-user")
        store.add_subscription(record.user_id, listing.id, rpm=60, quota=10_000)
        logger.warning("Memory store seeded with dev key for listing 'echo' -> %s", settings.dev_upstream_url)
    else:
        logger.warning("Memory store is empty: set SUPABASE_* or GATEWAY_DEV_API_KEY to serve traffic.")
    return store


def create_app(
    settings: Settings | None = None,
    *,
    store: Store | None = None,
    limiter: RateLimiter | None = None,
    http_client: httpx.AsyncClient | None = None,
    resolver: Resolver | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    settings.validate()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        deps = GatewayDeps(
            settings=settings,
            store=store or _default_store(settings),
            limiter=limiter
            or (RedisRateLimiter.from_url(settings.redis_url) if settings.redis_url else MemoryRateLimiter()),
            http=http_client
            or httpx.AsyncClient(
                timeout=httpx.Timeout(settings.upstream_timeout_s, connect=5.0),
                follow_redirects=False,  # a redirect could bounce us into a private network
                limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
            ),
            resolver=resolver or system_resolver,
        )
        app.state.deps = deps
        try:
            yield
        finally:
            # Only close what we created; injected dependencies belong to the caller.
            if http_client is None:
                await deps.http.aclose()
            if store is None:
                await deps.store.aclose()
            if limiter is None:
                await deps.limiter.aclose()

    app = FastAPI(title="APIKUBO Gateway", version=VERSION, lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.get("/health")
    async def health(request: Request) -> dict[str, str]:
        deps: GatewayDeps = request.app.state.deps
        return {"status": "ok", "version": VERSION, "store": deps.store.name, "rate_limiter": deps.limiter.name}

    @app.api_route("/v1/{slug}/{path:path}", methods=PROXY_METHODS)
    async def proxy(request: Request, slug: str, path: str) -> Response:
        return await _proxy(request, slug, path)

    @app.api_route("/v1/{slug}", methods=PROXY_METHODS, include_in_schema=False)
    async def proxy_root(request: Request, slug: str) -> Response:
        return await _proxy(request, slug, "")

    async def _proxy(request: Request, slug: str, path: str) -> Response:
        deps: GatewayDeps = request.app.state.deps
        incoming_id = request.headers.get("x-request-id", "")
        request_id = incoming_id if REQUEST_ID_PATTERN.fullmatch(incoming_id) else uuid.uuid4().hex

        # 1. Authenticate --------------------------------------------------
        raw_key = extract_api_key(request.headers.get("authorization"), request.headers.get("x-api-key"))
        if raw_key is None:
            return _error(401, "missing_api_key", "Send your key as 'Authorization: Bearer kubo_live_...'.", request_id,
                          {"WWW-Authenticate": "Bearer"})
        if not is_well_formed(raw_key):
            return _error(401, "invalid_api_key", "API key is malformed.", request_id, {"WWW-Authenticate": "Bearer"})
        if not is_valid_slug(slug):
            return _error(404, "listing_not_found", f"No published listing '{slug}'.", request_id)

        try:
            key = await deps.store.get_key(hash_key(raw_key))
            if key is None:
                return _error(401, "invalid_api_key", "API key not recognised.", request_id, {"WWW-Authenticate": "Bearer"})
            key_status = key.status(datetime.now(timezone.utc))
            if key_status != "active":
                return _error(403, f"key_{key_status}", f"This API key is {key_status}.", request_id)

            # 2. Authorise: listing exists and caller holds an active subscription
            listing = await deps.store.get_listing(slug)
            if listing is None:
                return _error(404, "listing_not_found", f"No published listing '{slug}'.", request_id)
            limits = await deps.store.get_plan_limits(key.user_id, listing.id)
            if limits is None:
                return _error(403, "subscription_required", f"Subscribe to '{slug}' before calling it.", request_id)
        except StoreUnavailable:
            logger.exception("store unavailable (request_id=%s)", request_id)
            return _error(503, "store_unavailable", "Gateway cannot verify credentials right now.", request_id,
                          {"Retry-After": "5"})

        # 3. Meter ------------------------------------------------------------
        try:
            decision = await deps.limiter.check(f"{key.user_id}:{listing.id}", limits.rate_limit_rpm, limits.quota_monthly)
        except LimiterUnavailable:
            logger.exception("rate limiter unavailable (request_id=%s)", request_id)
            return _error(503, "rate_limiter_unavailable", "Usage metering is temporarily unavailable.", request_id,
                          {"Retry-After": "5"})
        limit_headers = _limit_headers(decision)
        if not decision.allowed:
            message = ("Rate limit exceeded for this plan." if decision.reason == "rate_limited"
                       else "Monthly quota exhausted for this plan.")
            return _error(429, decision.reason or "rate_limited", message, request_id,
                          {**limit_headers, "Retry-After": str(decision.retry_after)})

        # 4. Build the upstream request ---------------------------------------
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > deps.settings.max_body_bytes:
            return _error(413, "payload_too_large", "Request body exceeds the gateway limit.", request_id, limit_headers)
        body = await request.body()
        if len(body) > deps.settings.max_body_bytes:
            return _error(413, "payload_too_large", "Request body exceeds the gateway limit.", request_id, limit_headers)

        try:
            upstream_url = build_upstream_url(listing.base_url, path, request.url.query)
        except ValueError:
            return _error(400, "invalid_path", "Path traversal segments are not allowed.", request_id, limit_headers)
        try:
            target = await resolve_target(upstream_url, allow_private=deps.settings.allow_private_upstreams,
                                          resolver=deps.resolver)
        except UpstreamBlocked as exc:
            logger.warning("blocked upstream for %s: %s (request_id=%s)", slug, exc, request_id)
            return _error(502, "upstream_blocked", "The provider endpoint is not a permitted public HTTPS target.",
                          request_id, limit_headers)
        except UpstreamUnresolvable:
            return _error(502, "upstream_unreachable", "The provider endpoint could not be resolved.", request_id,
                          limit_headers)

        headers = {k: v for k, v in request.headers.items() if k.lower() not in _STRIP_REQUEST_HEADERS}
        headers["host"] = target.host_header
        headers["x-kubo-request-id"] = request_id
        headers["x-kubo-subscription-id"] = limits.subscription_id
        if request.client:
            headers["x-forwarded-for"] = request.client.host
        extensions = {"sni_hostname": target.sni_hostname} if target.sni_hostname else {}

        # 5. Proxy & stream back ----------------------------------------------
        started = time.perf_counter()
        upstream_request = deps.http.build_request(request.method, target.url, headers=headers, content=body,
                                                   extensions=extensions)
        try:
            upstream = await deps.http.send(upstream_request, stream=True)
        except httpx.TimeoutException:
            return _error(504, "upstream_timeout", "The provider did not respond in time.", request_id, limit_headers)
        except httpx.HTTPError:
            logger.warning("upstream connect error for %s (request_id=%s)", slug, request_id)
            return _error(502, "upstream_unreachable", "Could not connect to the provider.", request_id, limit_headers)
        elapsed_ms = int((time.perf_counter() - started) * 1000)

        response_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in _STRIP_RESPONSE_HEADERS}
        response_headers.update(limit_headers)
        response_headers["X-Request-Id"] = request_id
        response_headers["X-Kubo-Upstream-Ms"] = str(elapsed_ms)

        async def body_stream() -> AsyncIterator[bytes]:
            sent = 0
            try:
                async for chunk in upstream.aiter_raw():
                    sent += len(chunk)
                    yield chunk
            finally:
                await upstream.aclose()
                event = UsageEvent(
                    api_key_id=key.id,
                    listing_id=listing.id,
                    user_id=key.user_id,
                    endpoint=f"{request.method} /{path}",
                    status_code=upstream.status_code,
                    response_time_ms=elapsed_ms,
                    bytes_transferred=sent,
                )
                try:
                    await deps.store.record_usage(event)
                except StoreUnavailable:
                    logger.exception("failed to record usage (request_id=%s)", request_id)

        return StreamingResponse(body_stream(), status_code=upstream.status_code, headers=response_headers)

    return app
