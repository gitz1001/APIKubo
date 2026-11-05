"""Per-subscription rate limiting (requests/minute) and monthly quotas.

Both limiters use fixed windows: a per-minute counter and a per-calendar-month
(UTC) counter. A request that is rate limited does not consume monthly quota.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Protocol

Clock = Callable[[], float]


class LimiterUnavailable(Exception):
    """The limiter backend failed. The gateway fails closed rather than serve unmetered traffic."""


@dataclass(frozen=True)
class LimitDecision:
    allowed: bool
    reason: str | None  # "rate_limited" | "quota_exceeded" | None
    rpm_limit: int
    rpm_remaining: int
    rpm_reset: int  # epoch seconds when the minute window resets
    quota_limit: int
    quota_remaining: int
    quota_reset: int  # epoch seconds when the monthly window resets

    @property
    def retry_after(self) -> int:
        target = self.rpm_reset if self.reason == "rate_limited" else self.quota_reset
        return max(1, target - int(time.time()))


class RateLimiter(Protocol):
    name: str

    async def check(self, subject: str, rpm: int, quota: int) -> LimitDecision: ...

    async def aclose(self) -> None: ...


def _windows(now: float) -> tuple[int, int, str, int]:
    minute = int(now // 60)
    minute_reset = (minute + 1) * 60
    dt = datetime.fromtimestamp(now, tz=timezone.utc)
    month_key = f"{dt.year:04d}{dt.month:02d}"
    next_month = datetime(dt.year + (dt.month // 12), dt.month % 12 + 1, 1, tzinfo=timezone.utc)
    return minute, minute_reset, month_key, int(next_month.timestamp())


def _decide(rpm_count: int, quota_count: int, rpm: int, quota: int, rpm_reset: int, quota_reset: int, reason: str | None) -> LimitDecision:
    return LimitDecision(
        allowed=reason is None,
        reason=reason,
        rpm_limit=rpm,
        rpm_remaining=max(0, rpm - rpm_count),
        rpm_reset=rpm_reset,
        quota_limit=quota,
        quota_remaining=max(0, quota - quota_count),
        quota_reset=quota_reset,
    )


class MemoryRateLimiter:
    """Single-process limiter for development and tests. Not safe for multi-worker deployments."""

    name = "memory"

    def __init__(self, clock: Clock = time.time) -> None:
        self._clock = clock
        self._minute: dict[str, tuple[int, int]] = {}
        self._month: dict[str, tuple[str, int]] = {}

    async def check(self, subject: str, rpm: int, quota: int) -> LimitDecision:
        minute, minute_reset, month_key, month_reset = _windows(self._clock())

        window, count = self._minute.get(subject, (minute, 0))
        count = count + 1 if window == minute else 1
        self._minute[subject] = (minute, count)

        q_window, q_count = self._month.get(subject, (month_key, 0))
        if q_window != month_key:
            q_count = 0
        if count > rpm:
            self._month[subject] = (month_key, q_count)
            return _decide(count, q_count, rpm, quota, minute_reset, month_reset, "rate_limited")

        q_count += 1
        self._month[subject] = (month_key, q_count)
        reason = "quota_exceeded" if q_count > quota else None
        return _decide(count, q_count, rpm, quota, minute_reset, month_reset, reason)

    async def aclose(self) -> None:
        return None


# Atomic: increments the minute window, and only touches the monthly counter when
# the request is inside the rate limit.
_LUA_CHECK = """
local rpm_count = redis.call('INCR', KEYS[1])
if rpm_count == 1 then redis.call('EXPIRE', KEYS[1], 120) end
if rpm_count > tonumber(ARGV[1]) then
  local q = tonumber(redis.call('GET', KEYS[2]) or '0')
  return {0, rpm_count, q}
end
local q = redis.call('INCR', KEYS[2])
if q == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3])) end
if q > tonumber(ARGV[2]) then return {2, rpm_count, q} end
return {1, rpm_count, q}
"""


class RedisRateLimiter:
    name = "redis"

    def __init__(self, redis_client: object, clock: Clock = time.time) -> None:
        self._redis = redis_client
        self._clock = clock
        self._script = redis_client.register_script(_LUA_CHECK)  # type: ignore[attr-defined]

    @classmethod
    def from_url(cls, url: str) -> RedisRateLimiter:
        from redis import asyncio as redis_asyncio

        return cls(redis_asyncio.from_url(url, socket_timeout=1.0, socket_connect_timeout=1.0))

    async def check(self, subject: str, rpm: int, quota: int) -> LimitDecision:
        now = self._clock()
        minute, minute_reset, month_key, month_reset = _windows(now)
        keys = [f"kubo:rl:{subject}:{minute}", f"kubo:quota:{subject}:{month_key}"]
        # Relative TTL (not EXPIREAT) so gateway/Redis clock skew cannot expire counters early.
        quota_ttl = max(1, month_reset - int(now)) + 86_400
        try:
            status, rpm_count, quota_count = await self._script(keys=keys, args=[rpm, quota, quota_ttl])
        except Exception as exc:  # redis raises many error types; all mean "cannot meter"
            raise LimiterUnavailable(str(exc)) from exc
        reason = {0: "rate_limited", 2: "quota_exceeded"}.get(int(status))
        return _decide(int(rpm_count), int(quota_count), rpm, quota, minute_reset, month_reset, reason)

    async def aclose(self) -> None:
        close = getattr(self._redis, "aclose", None)
        if close is not None:
            await close()
