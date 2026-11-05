from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


def parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class KeyRecord:
    id: str
    user_id: str
    revoked_at: datetime | None = None
    expires_at: datetime | None = None

    def status(self, now: datetime) -> str:
        if self.revoked_at is not None:
            return "revoked"
        if self.expires_at is not None and self.expires_at <= now:
            return "expired"
        return "active"


@dataclass(frozen=True)
class ListingRecord:
    id: str
    slug: str
    base_url: str


@dataclass(frozen=True)
class PlanLimits:
    subscription_id: str
    plan_id: str
    rate_limit_rpm: int
    quota_monthly: int


@dataclass(frozen=True)
class UsageEvent:
    api_key_id: str
    listing_id: str
    user_id: str
    endpoint: str
    status_code: int
    response_time_ms: int
    bytes_transferred: int
