from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app.models import UsageEvent
from app.store import StoreUnavailable, SupabaseStore


def _store(handler: httpx.MockTransport) -> SupabaseStore:
    client = httpx.AsyncClient(base_url="https://proj.supabase.co/rest/v1", transport=handler)
    return SupabaseStore("https://proj.supabase.co", "service-key", client=client, cache_ttl_s=60)


def test_queries_and_parses_rows() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        table = request.url.path.rsplit("/", 1)[-1]
        rows = {
            "api_keys": [{"id": "k1", "user_id": "u1", "revoked_at": None, "expires_at": "2099-01-01T00:00:00Z"}],
            "listings": [{"id": "l1", "slug": "weather", "base_url": "https://api.example"}],
            "subscriptions": [
                {"id": "s1", "plan_id": "p1", "current_period_end": None,
                 "plans": {"rate_limit_rpm": 30, "quota_monthly": 500, "is_active": True}}
            ],
        }[table]
        return httpx.Response(200, json=rows)

    async def scenario() -> None:
        store = _store(httpx.MockTransport(handler))
        key = await store.get_key("ab" * 32)
        assert key is not None and key.user_id == "u1" and key.expires_at is not None
        listing = await store.get_listing("weather")
        assert listing is not None and listing.base_url == "https://api.example"
        limits = await store.get_plan_limits("u1", "l1")
        assert limits is not None and (limits.rate_limit_rpm, limits.quota_monthly) == (30, 500)

        # Cached: a second lookup makes no new request.
        await store.get_key("ab" * 32)
        assert len(seen) == 3

    asyncio.run(scenario())
    key_query = seen[0].url.params
    assert key_query["key_hash"] == "eq." + "ab" * 32
    assert "key_hash" not in key_query["select"]  # never pull the hash back out
    assert seen[1].url.params["status"] == "eq.published"
    assert seen[2].url.params["status"] == "in.(active,trialing)"


@pytest.mark.parametrize(
    "subscription",
    [
        {"id": "s1", "plan_id": "p1", "current_period_end": None, "plans": {"rate_limit_rpm": 1, "quota_monthly": 1, "is_active": False}},
        {"id": "s1", "plan_id": "p1", "current_period_end": "2000-01-01T00:00:00Z", "plans": {"rate_limit_rpm": 1, "quota_monthly": 1, "is_active": True}},
    ],
)
def test_inactive_plan_or_lapsed_period_denies(subscription: dict[str, object]) -> None:
    store = _store(httpx.MockTransport(lambda request: httpx.Response(200, json=[subscription])))
    assert asyncio.run(store.get_plan_limits("u1", "l1")) is None


def test_record_usage_calls_rpc_and_errors_surface() -> None:
    bodies: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(204)

    event = UsageEvent("k1", "l1", "u1", "GET /x", 200, 12, 345)
    asyncio.run(_store(httpx.MockTransport(handler)).record_usage(event))
    assert bodies[0]["p_status_code"] == 200 and bodies[0]["p_bytes"] == 345

    failing = _store(httpx.MockTransport(lambda request: httpx.Response(500)))
    with pytest.raises(StoreUnavailable):
        asyncio.run(failing.get_key("cd" * 32))
