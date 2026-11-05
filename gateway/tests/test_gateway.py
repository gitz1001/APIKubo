from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.config import Settings
from app.keys import hash_key
from conftest import OTHER_KEY, PUBLIC_IP, VALID_KEY, Harness, auth


def test_health(harness: Harness) -> None:
    body = harness.client.get("/health").json()
    assert body["status"] == "ok"
    assert body["store"] == "memory"


@pytest.mark.parametrize(
    ("headers", "status", "code"),
    [
        ({}, 401, "missing_api_key"),
        ({"Authorization": "Bearer not-a-kubo-key"}, 401, "invalid_api_key"),
        ({"Authorization": f"Bearer {OTHER_KEY}"}, 401, "invalid_api_key"),
    ],
)
def test_rejects_bad_credentials(harness: Harness, headers: dict[str, str], status: int, code: str) -> None:
    response = harness.client.get("/v1/weather/forecast", headers=headers)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert harness.upstream.requests == []


def test_accepts_x_api_key_header(harness: Harness) -> None:
    response = harness.client.get("/v1/weather/forecast", headers={"X-API-Key": VALID_KEY})
    assert response.status_code == 200


def test_revoked_and_expired_keys_are_forbidden(harness: Harness) -> None:
    harness.store.add_key(OTHER_KEY, user_id="user-1", revoked=True)
    assert harness.client.get("/v1/weather/x", headers=auth(OTHER_KEY)).json()["error"]["code"] == "key_revoked"

    expired = "kubo_test_" + "C" * 43
    harness.store.add_key(expired, user_id="user-1", expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
    response = harness.client.get("/v1/weather/x", headers=auth(expired))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "key_expired"


def test_unknown_or_malformed_listing_is_404(harness: Harness) -> None:
    assert harness.client.get("/v1/nope-nope/x", headers=auth()).status_code == 404
    assert harness.client.get("/v1/Bad_Slug!/x", headers=auth()).status_code == 404


def test_requires_subscription(harness: Harness) -> None:
    harness.store.add_listing("geo-lookup", "https://api.provider.example")
    response = harness.client.get("/v1/geo-lookup/ip", headers=auth())
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "subscription_required"


def test_proxies_request_and_strips_credentials(harness: Harness) -> None:
    response = harness.client.post(
        "/v1/weather/forecast/today?city=Manila&units=metric",
        headers={**auth(), "Cookie": "session=secret", "X-Custom": "kept", "X-Request-Id": "trace-abc-123"},
        content=b'{"days": 3}',
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True, "path": "/v2/forecast/today"}
    assert response.headers["x-provider"] == "demo"
    assert response.headers["x-request-id"] == "trace-abc-123"
    assert response.headers["x-ratelimit-limit"] == "5"
    assert response.headers["x-ratelimit-remaining"] == "4"
    assert response.headers["x-quota-remaining"] == "99"

    sent = harness.upstream.requests[0]
    assert sent.method == "POST"
    assert sent.url.host == PUBLIC_IP  # connection pinned to the vetted IP
    assert sent.headers["host"] == "api.provider.example"
    assert sent.url.query == b"city=Manila&units=metric"
    assert sent.content == b'{"days": 3}'
    assert sent.headers["x-custom"] == "kept"
    assert sent.headers["x-kubo-request-id"] == "trace-abc-123"
    assert "authorization" not in sent.headers
    assert "cookie" not in sent.headers
    assert sent.extensions["sni_hostname"] == "api.provider.example"


def test_records_usage_after_streaming(harness: Harness) -> None:
    harness.upstream.handler = lambda req: httpx.Response(201, content=b"x" * 1234)
    harness.client.put("/v1/weather/items/7", headers=auth(), content=b"{}")
    [event] = harness.store.usage
    assert event.status_code == 201
    assert event.bytes_transferred == 1234
    assert event.endpoint == "PUT /items/7"
    assert event.user_id == "user-1"


def test_upstream_errors_pass_through_and_are_metered(harness: Harness) -> None:
    harness.upstream.handler = lambda req: httpx.Response(503, json={"provider": "down"})
    response = harness.client.get("/v1/weather/x", headers=auth())
    assert response.status_code == 503
    assert harness.store.usage[0].status_code == 503


def test_rate_limit_returns_429_with_retry_after(harness: Harness) -> None:
    for _ in range(5):
        assert harness.client.get("/v1/weather/x", headers=auth()).status_code == 200
    response = harness.client.get("/v1/weather/x", headers=auth())
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert int(response.headers["retry-after"]) >= 1
    assert len(harness.upstream.requests) == 5


def test_monthly_quota_enforced(harness: Harness) -> None:
    listing = harness.store.add_listing("tiny", "https://api.provider.example")
    harness.store.add_subscription("user-1", listing.id, rpm=100, quota=2)
    codes = [harness.client.get("/v1/tiny/x", headers=auth()).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


@pytest.mark.parametrize(
    ("base_url", "resolves_to"),
    [
        ("https://internal.example", ["10.0.0.5"]),
        ("https://metadata.example", ["169.254.169.254"]),
        ("https://loop.example", ["127.0.0.1"]),
        ("https://mixed.example", ["93.184.215.14", "192.168.1.10"]),
        ("https://mapped.example", ["::ffff:127.0.0.1"]),
        ("http://plain.example", ["93.184.215.14"]),
    ],
)
def test_ssrf_targets_are_blocked(harness: Harness, base_url: str, resolves_to: list[str]) -> None:
    host = base_url.split("//", 1)[1]
    harness.resolved[host] = resolves_to
    listing = harness.store.add_listing("risky", base_url)
    harness.store.add_subscription("user-1", listing.id)
    response = harness.client.get("/v1/risky/latest", headers=auth())
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "upstream_blocked"
    assert harness.upstream.requests == []


def test_path_traversal_rejected(harness: Harness) -> None:
    response = harness.client.get("/v1/weather/a/%2E%2E/admin", headers=auth())
    assert response.status_code == 400
    assert harness.upstream.requests == []


def test_body_size_limit(harness: Harness) -> None:
    response = harness.client.post("/v1/weather/upload", headers=auth(), content=b"x" * (10 * 1024 * 1024 + 1))
    assert response.status_code == 413


def test_upstream_timeout_maps_to_504(harness: Harness) -> None:
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    harness.upstream.handler = boom
    response = harness.client.get("/v1/weather/x", headers=auth())
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "upstream_timeout"


def test_upstream_set_cookie_is_not_relayed(harness: Harness) -> None:
    harness.upstream.handler = lambda req: httpx.Response(200, headers={"set-cookie": "tracker=1"}, content=b"ok")
    response = harness.client.get("/v1/weather/x", headers=auth())
    assert "set-cookie" not in response.headers


def test_secrets_never_echoed(harness: Harness) -> None:
    for path in ("/v1/weather/x", "/v1/missing-listing/x"):
        response = harness.client.get(path, headers=auth())
        assert VALID_KEY not in response.text
        assert hash_key(VALID_KEY) not in response.text


def test_production_refuses_unsafe_config() -> None:
    with pytest.raises(RuntimeError):
        Settings(environment="production").validate()
    with pytest.raises(RuntimeError):
        Settings(
            environment="production",
            supabase_url="https://x.supabase.co",
            supabase_service_role_key="k",
            redis_url="redis://r",
            allow_private_upstreams=True,
        ).validate()
