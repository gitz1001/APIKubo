"""API key parsing and hashing.

Keys are 256-bit random secrets (``kubo_live_<43 base64url chars>``), so a single
SHA-256 is sufficient: there is no low-entropy password to brute force. Only the
hash is ever stored or compared; the plaintext key never leaves the request.
"""

from __future__ import annotations

import hashlib
import re

KEY_PATTERN = re.compile(r"^kubo_(live|test)_[A-Za-z0-9_-]{32,64}$")
SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$")


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def is_well_formed(raw_key: str) -> bool:
    return bool(KEY_PATTERN.fullmatch(raw_key))


def is_valid_slug(slug: str) -> bool:
    return bool(SLUG_PATTERN.fullmatch(slug))


def extract_api_key(authorization: str | None, x_api_key: str | None) -> str | None:
    """Accept ``Authorization: Bearer <key>`` (preferred) or ``X-API-Key: <key>``."""
    if authorization:
        scheme, _, token = authorization.strip().partition(" ")
        if scheme.lower() == "bearer" and token.strip():
            return token.strip()
    if x_api_key and x_api_key.strip():
        return x_api_key.strip()
    return None
