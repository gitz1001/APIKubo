from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _env_bool(name: str, default: bool = False) -> bool:
    value = _env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = _env(name)
    return float(value) if value is not None else default


def _env_int(name: str, default: int) -> int:
    value = _env(name)
    return int(value) if value is not None else default


@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    redis_url: str | None = None
    upstream_timeout_s: float = 30.0
    max_body_bytes: int = 10 * 1024 * 1024
    allow_private_upstreams: bool = False
    cache_ttl_s: float = 15.0
    dev_api_key: str | None = None
    dev_upstream_url: str = "https://httpbin.org/anything"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def use_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    def validate(self) -> None:
        """Refuse unsafe configurations before the gateway accepts traffic."""
        if not self.is_production:
            return
        if not self.use_supabase:
            raise RuntimeError("Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        if not self.redis_url:
            raise RuntimeError("Production requires REDIS_URL; in-memory limits do not survive restarts or scale out.")
        if self.allow_private_upstreams:
            raise RuntimeError("GATEWAY_ALLOW_PRIVATE_UPSTREAMS must be off in production (SSRF risk).")
        if self.dev_api_key:
            raise RuntimeError("GATEWAY_DEV_API_KEY must not be set in production.")

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            environment=(_env("GATEWAY_ENV", "development") or "development").lower(),
            supabase_url=_env("SUPABASE_URL") or _env("NEXT_PUBLIC_SUPABASE_URL"),
            supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
            redis_url=_env("REDIS_URL"),
            upstream_timeout_s=_env_float("GATEWAY_UPSTREAM_TIMEOUT", 30.0),
            max_body_bytes=_env_int("GATEWAY_MAX_BODY_BYTES", 10 * 1024 * 1024),
            allow_private_upstreams=_env_bool("GATEWAY_ALLOW_PRIVATE_UPSTREAMS"),
            cache_ttl_s=_env_float("GATEWAY_CACHE_TTL", 15.0),
            dev_api_key=_env("GATEWAY_DEV_API_KEY"),
            dev_upstream_url=_env("GATEWAY_DEV_UPSTREAM_URL", "https://httpbin.org/anything")
            or "https://httpbin.org/anything",
        )
