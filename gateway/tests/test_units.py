from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import fakeredis
import pytest

from app.keys import extract_api_key, hash_key, is_valid_slug, is_well_formed
from app.ratelimit import MemoryRateLimiter, RedisRateLimiter
from app.upstream import build_upstream_url


def test_hash_key_is_sha256_hex() -> None:
    assert hash_key("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


@pytest.mark.parametrize(
    ("authorization", "x_api_key", "expected"),
    [
        ("Bearer kubo_live_x", None, "kubo_live_x"),
        ("bearer   kubo_live_y  ", None, "kubo_live_y"),
        ("Basic abc", "kubo_live_z", "kubo_live_z"),
        (None, None, None),
        ("Bearer ", None, None),
    ],
)
def test_extract_api_key(authorization: str | None, x_api_key: str | None, expected: str | None) -> None:
    assert extract_api_key(authorization, x_api_key) == expected


def test_key_and_slug_formats() -> None:
    assert is_well_formed("kubo_live_" + "a" * 43)
    assert not is_well_formed("kubo_live_short")
    assert not is_well_formed("sk_live_" + "a" * 43)
    assert is_valid_slug("global-fx")
    assert not is_valid_slug("ab")  # too short; matches the DB check constraint
    assert not is_valid_slug("-leading")
    assert not is_valid_slug("Upper")


def test_build_upstream_url() -> None:
    assert build_upstream_url("https://a.example/v1/", "x/y", "q=1") == "https://a.example/v1/x/y?q=1"
    assert build_upstream_url("https://a.example", "", "") == "https://a.example/"
    assert build_upstream_url("https://a.example", "a b", "") == "https://a.example/a%20b"
    with pytest.raises(ValueError):
        build_upstream_url("https://a.example/v1", "../admin", "")


class Clock:
    def __init__(self, now: float) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def _run_limiter_scenario(limiter: MemoryRateLimiter | RedisRateLimiter, clock: Clock) -> None:
    async def scenario() -> None:
        results = [await limiter.check("s", rpm=2, quota=3) for _ in range(3)]
        assert [r.allowed for r in results] == [True, True, False]
        assert results[2].reason == "rate_limited"
        assert results[2].quota_remaining == 1  # rate-limited call did not burn quota

        clock.now += 60  # next minute window
        fourth = await limiter.check("s", rpm=2, quota=3)
        fifth = await limiter.check("s", rpm=2, quota=3)
        assert fourth.allowed and not fifth.allowed
        assert fifth.reason == "quota_exceeded"

        other = await limiter.check("other", rpm=2, quota=3)
        assert other.allowed  # subjects are isolated

    asyncio.run(scenario())


def test_memory_limiter_windows() -> None:
    clock = Clock(datetime(2026, 3, 10, 12, 0, 5, tzinfo=timezone.utc).timestamp())
    _run_limiter_scenario(MemoryRateLimiter(clock=clock), clock)


def test_redis_limiter_lua_script() -> None:
    clock = Clock(datetime(2026, 3, 10, 12, 0, 5, tzinfo=timezone.utc).timestamp())
    _run_limiter_scenario(RedisRateLimiter(fakeredis.FakeAsyncRedis(), clock=clock), clock)


def test_quota_resets_at_month_boundary() -> None:
    clock = Clock(datetime(2026, 12, 31, 23, 59, 30, tzinfo=timezone.utc).timestamp())
    limiter = MemoryRateLimiter(clock=clock)

    async def scenario() -> None:
        first = await limiter.check("s", rpm=10, quota=1)
        assert first.allowed
        assert first.quota_reset == int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp())
        assert not (await limiter.check("s", rpm=10, quota=1)).allowed
        clock.now += 60
        assert (await limiter.check("s", rpm=10, quota=1)).allowed

    asyncio.run(scenario())
