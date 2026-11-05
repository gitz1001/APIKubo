"""Data access for the gateway.

``SupabaseStore`` talks to PostgREST with the service-role key (bypasses RLS, so it
must only ever run server-side). ``MemoryStore`` backs tests and local development.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Generic, Protocol, TypeVar

import httpx

from .keys import hash_key
from .models import KeyRecord, ListingRecord, PlanLimits, UsageEvent, parse_timestamp


class StoreUnavailable(Exception):
    """The backing store could not be reached; the gateway fails closed."""


class Store(Protocol):
    name: str

    async def get_key(self, key_hash: str) -> KeyRecord | None: ...

    async def get_listing(self, slug: str) -> ListingRecord | None: ...

    async def get_plan_limits(self, user_id: str, listing_id: str) -> PlanLimits | None: ...

    async def record_usage(self, event: UsageEvent) -> None: ...

    async def aclose(self) -> None: ...


# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------


@dataclass
class MemoryStore:
    name: str = "memory"
    keys: dict[str, KeyRecord] = field(default_factory=dict)
    listings: dict[str, ListingRecord] = field(default_factory=dict)
    plans: dict[tuple[str, str], PlanLimits] = field(default_factory=dict)
    usage: list[UsageEvent] = field(default_factory=list)

    def add_key(
        self,
        raw_key: str,
        user_id: str,
        *,
        revoked: bool = False,
        expires_at: datetime | None = None,
    ) -> KeyRecord:
        record = KeyRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            revoked_at=datetime.now(timezone.utc) if revoked else None,
            expires_at=expires_at,
        )
        self.keys[hash_key(raw_key)] = record
        return record

    def add_listing(self, slug: str, base_url: str) -> ListingRecord:
        record = ListingRecord(id=str(uuid.uuid4()), slug=slug, base_url=base_url)
        self.listings[slug] = record
        return record

    def add_subscription(
        self, user_id: str, listing_id: str, *, rpm: int = 60, quota: int = 1000
    ) -> PlanLimits:
        limits = PlanLimits(
            subscription_id=str(uuid.uuid4()),
            plan_id=str(uuid.uuid4()),
            rate_limit_rpm=rpm,
            quota_monthly=quota,
        )
        self.plans[(user_id, listing_id)] = limits
        return limits

    async def get_key(self, key_hash: str) -> KeyRecord | None:
        return self.keys.get(key_hash)

    async def get_listing(self, slug: str) -> ListingRecord | None:
        return self.listings.get(slug)

    async def get_plan_limits(self, user_id: str, listing_id: str) -> PlanLimits | None:
        return self.plans.get((user_id, listing_id))

    async def record_usage(self, event: UsageEvent) -> None:
        self.usage.append(event)

    async def aclose(self) -> None:
        return None


# ---------------------------------------------------------------------------
# Supabase (PostgREST) store
# ---------------------------------------------------------------------------

T = TypeVar("T")
_MISSING = object()


class TTLCache(Generic[T]):
    """Tiny bounded TTL cache. Caches misses too, which blunts key-guessing floods."""

    def __init__(self, ttl_s: float, max_entries: int = 10_000) -> None:
        self._ttl = ttl_s
        self._max = max_entries
        self._data: dict[str, tuple[float, T | None]] = {}

    def get(self, key: str) -> T | None | object:
        hit = self._data.get(key)
        if hit is None:
            return _MISSING
        expires, value = hit
        if expires < time.monotonic():
            self._data.pop(key, None)
            return _MISSING
        return value

    def set(self, key: str, value: T | None) -> None:
        if self._ttl <= 0:
            return
        if len(self._data) >= self._max:
            self._data.clear()
        self._data[key] = (time.monotonic() + self._ttl, value)


class SupabaseStore:
    name = "supabase"

    def __init__(
        self,
        url: str,
        service_role_key: str,
        *,
        cache_ttl_s: float = 15.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._client = client or httpx.AsyncClient(
            base_url=f"{url.rstrip('/')}/rest/v1",
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Accept": "application/json",
            },
            timeout=httpx.Timeout(5.0),
        )
        self._keys: TTLCache[KeyRecord] = TTLCache(cache_ttl_s)
        self._listings: TTLCache[ListingRecord] = TTLCache(cache_ttl_s * 4)
        self._plans: TTLCache[PlanLimits] = TTLCache(cache_ttl_s)

    async def _get_rows(self, path: str, params: dict[str, str]) -> list[dict[str, object]]:
        try:
            response = await self._client.get(path, params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise StoreUnavailable(str(exc)) from exc
        payload = response.json()
        return payload if isinstance(payload, list) else []

    async def get_key(self, key_hash: str) -> KeyRecord | None:
        cached = self._keys.get(key_hash)
        if cached is not _MISSING:
            return cached  # type: ignore[return-value]
        rows = await self._get_rows(
            "/api_keys",
            {
                "key_hash": f"eq.{key_hash}",
                "select": "id,user_id,revoked_at,expires_at",
                "limit": "1",
            },
        )
        record = None
        if rows:
            row = rows[0]
            record = KeyRecord(
                id=str(row["id"]),
                user_id=str(row["user_id"]),
                revoked_at=parse_timestamp(row.get("revoked_at")),
                expires_at=parse_timestamp(row.get("expires_at")),
            )
        self._keys.set(key_hash, record)
        return record

    async def get_listing(self, slug: str) -> ListingRecord | None:
        cached = self._listings.get(slug)
        if cached is not _MISSING:
            return cached  # type: ignore[return-value]
        rows = await self._get_rows(
            "/listings",
            {
                "slug": f"eq.{slug}",
                "status": "eq.published",
                "select": "id,slug,base_url",
                "limit": "1",
            },
        )
        record = None
        if rows and rows[0].get("base_url"):
            row = rows[0]
            record = ListingRecord(id=str(row["id"]), slug=str(row["slug"]), base_url=str(row["base_url"]))
        self._listings.set(slug, record)
        return record

    async def get_plan_limits(self, user_id: str, listing_id: str) -> PlanLimits | None:
        cache_key = f"{user_id}:{listing_id}"
        cached = self._plans.get(cache_key)
        if cached is not _MISSING:
            return cached  # type: ignore[return-value]
        rows = await self._get_rows(
            "/subscriptions",
            {
                "user_id": f"eq.{user_id}",
                "listing_id": f"eq.{listing_id}",
                "status": "in.(active,trialing)",
                "select": "id,plan_id,current_period_end,plans(rate_limit_rpm,quota_monthly,is_active)",
                "limit": "1",
            },
        )
        record = None
        if rows:
            row = rows[0]
            plan = row.get("plans")
            period_end = parse_timestamp(row.get("current_period_end"))
            still_current = period_end is None or period_end > datetime.now(timezone.utc)
            if isinstance(plan, dict) and plan.get("is_active") and still_current:
                record = PlanLimits(
                    subscription_id=str(row["id"]),
                    plan_id=str(row["plan_id"]),
                    rate_limit_rpm=int(plan["rate_limit_rpm"]),
                    quota_monthly=int(plan["quota_monthly"]),
                )
        self._plans.set(cache_key, record)
        return record

    async def record_usage(self, event: UsageEvent) -> None:
        try:
            response = await self._client.post(
                "/rpc/record_usage",
                json={
                    "p_api_key_id": event.api_key_id,
                    "p_listing_id": event.listing_id,
                    "p_user_id": event.user_id,
                    "p_endpoint": event.endpoint[:512],
                    "p_status_code": event.status_code,
                    "p_response_time_ms": event.response_time_ms,
                    "p_bytes": event.bytes_transferred,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise StoreUnavailable(str(exc)) from exc

    async def aclose(self) -> None:
        await self._client.aclose()
