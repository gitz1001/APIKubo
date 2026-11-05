from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Iterator

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.ratelimit import MemoryRateLimiter  # noqa: E402
from app.store import MemoryStore  # noqa: E402

VALID_KEY = "kubo_live_" + "A" * 43
OTHER_KEY = "kubo_live_" + "B" * 43
PUBLIC_IP = "93.184.215.14"


class Upstream:
    """Records requests and replies via a programmable handler."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.handler: Callable[[httpx.Request], httpx.Response] = lambda req: httpx.Response(
            200, json={"ok": True, "path": req.url.path}, headers={"x-provider": "demo"}
        )

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        canned = self.handler(request)
        # httpx pre-reads Response(content=...); real transports hand back an unread stream.
        headers = {k: v for k, v in canned.headers.items() if k.lower() != "content-length"}
        return httpx.Response(canned.status_code, headers=headers, stream=_Stream(canned.content))


class _Stream(httpx.AsyncByteStream):
    def __init__(self, data: bytes) -> None:
        self._data = data

    async def __aiter__(self):  # type: ignore[override]
        for start in range(0, len(self._data), 512):
            yield self._data[start : start + 512]


class Harness:
    def __init__(self, client: TestClient, store: MemoryStore, upstream: Upstream, resolved: dict[str, list[str]]) -> None:
        self.client = client
        self.store = store
        self.upstream = upstream
        self.resolved = resolved


@pytest.fixture
def harness() -> Iterator[Harness]:
    store = MemoryStore()
    listing = store.add_listing("weather", "https://api.provider.example/v2")
    key = store.add_key(VALID_KEY, user_id="user-1")
    store.add_subscription(key.user_id, listing.id, rpm=5, quota=100)

    upstream = Upstream()
    resolved: dict[str, list[str]] = {"api.provider.example": [PUBLIC_IP]}

    async def fake_resolver(host: str, port: int) -> list[str]:
        return resolved.get(host, [])

    app = create_app(
        Settings(environment="test"),
        store=store,
        limiter=MemoryRateLimiter(),
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(upstream)),
        resolver=fake_resolver,
    )
    with TestClient(app) as client:
        yield Harness(client, store, upstream, resolved)


def auth(key: str = VALID_KEY) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}
