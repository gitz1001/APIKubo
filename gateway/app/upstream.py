"""Upstream target resolution with SSRF protection.

Listing ``base_url`` values are provider-controlled, so the gateway must never let
them reach private networks (cloud metadata, Redis, internal services). We resolve
the hostname once, reject any non-public address, and then *pin* the connection to
the vetted IP (sending the original Host header and TLS SNI). Pinning closes the
DNS-rebinding gap where a second lookup could return a private address.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Awaitable, Callable
from urllib.parse import quote, urlsplit, urlunsplit

Resolver = Callable[[str, int], Awaitable[list[str]]]


class UpstreamBlocked(Exception):
    """The upstream is not an allowed public HTTPS target."""


class UpstreamUnresolvable(Exception):
    """DNS resolution for the upstream failed."""


@dataclass(frozen=True)
class UpstreamTarget:
    url: str  # URL actually dialed (host may be a pinned IP literal)
    host_header: str
    sni_hostname: str | None


async def system_resolver(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UpstreamUnresolvable(host) from exc
    return [str(info[4][0]) for info in infos]


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def build_upstream_url(base_url: str, path: str, query: str) -> str:
    """Join base_url + consumer path. Rejects dot-segments so callers cannot climb above base_url."""
    segments = path.split("/") if path else []
    if any(segment in {".", ".."} for segment in segments):
        raise ValueError("path traversal is not allowed")
    base = urlsplit(base_url)
    joined_path = base.path.rstrip("/") + "/" + "/".join(quote(s, safe="@:!$&'()*+,;=-._~") for s in segments)
    return urlunsplit((base.scheme, base.netloc, joined_path, query, ""))


async def resolve_target(url: str, *, allow_private: bool, resolver: Resolver) -> UpstreamTarget:
    parts = urlsplit(url)
    host = parts.hostname
    if not host or parts.username or parts.password:
        raise UpstreamBlocked("upstream URL must have a host and no credentials")
    host_header = parts.netloc

    if allow_private:
        if parts.scheme not in {"http", "https"}:
            raise UpstreamBlocked("unsupported scheme")
        return UpstreamTarget(url=url, host_header=host_header, sni_hostname=None)

    if parts.scheme != "https":
        raise UpstreamBlocked("upstream must use https")

    port = parts.port or 443
    addresses = await resolver(host, port)
    if not addresses:
        raise UpstreamUnresolvable(host)
    if not all(_is_public(address) for address in addresses):
        raise UpstreamBlocked("upstream resolves to a non-public address")

    pinned = addresses[0]
    literal = f"[{pinned}]" if ":" in pinned else pinned
    netloc = f"{literal}:{parts.port}" if parts.port else literal
    pinned_url = urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))
    return UpstreamTarget(url=pinned_url, host_header=host_header, sni_hostname=host)
