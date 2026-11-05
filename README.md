# APIKUBO

A marketplace for APIs and AI Skills with a gateway-first architecture: consumers subscribe to a plan and call
every listing through one gateway with one key; providers get auth, rate limits, quotas and usage metering for free.

```
consumer ──Bearer kubo_live_…──▶  gateway (FastAPI)  ──▶  provider base_url (HTTPS, public)
                                   │ hash key → api_keys
                                   │ subscription → plan limits
                                   │ Redis: rpm + monthly quota
                                   └ record_usage RPC → usage_events + hourly rollups
web (Next.js 14) ── Supabase (Postgres + RLS + Google OAuth)
```

| Path | What it is |
| --- | --- |
| `web/` | Next.js 14 app: catalog, listing pages, publish flow, dashboard (keys, subscriptions, listings) |
| `web/supabase/migrations/` | Schema (`001`) and security hardening + RPCs (`002`) |
| `gateway/` | FastAPI reverse proxy: key auth, limits, SSRF guard, streaming, metering |
| `src/`, root `package.json` | Google AI Studio preview scaffold (Vite). Not the production app; see PROJECT_CONTEXT.md |

## Quick start (demo mode, no accounts needed)

```bash
cd web && npm install && npm run dev          # http://localhost:3000
```

With no Supabase credentials the web app runs in **demo mode**: seeded catalog, in-memory storage and a local
demo sign-in. Demo sign-in is disabled automatically in production builds.

```bash
cd gateway
python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
export GATEWAY_DEV_API_KEY="kubo_test_$(python -c 'import secrets;print(secrets.token_urlsafe(32))')"
uvicorn main:app --port 8000
curl -H "Authorization: Bearer $GATEWAY_DEV_API_KEY" localhost:8000/v1/echo/hello   # proxied to httpbin
```

## Going live

1. Create a Supabase project, enable the Google provider, and add `<APP_URL>/auth/callback` as a redirect URL.
2. Run `web/supabase/migrations/001_init.sql` then `002_security_hardening.sql` in the SQL editor.
3. `web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GATEWAY_URL`.
4. Gateway env (see `gateway/.env.example`): `GATEWAY_ENV=production`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`. Production refuses to start without them.

## Tests

```bash
cd gateway && pytest -q        # 40 tests: auth, limits (incl. Redis Lua via fakeredis), SSRF, streaming, store
cd web && npm test             # domain validation (open redirects, URLs, slugs, handles)
cd web && npx tsc --noEmit && npm run build
```

## Security model (short version)

- **Keys**: 256-bit random, shown once, stored only as SHA-256. Created/revoked via `SECURITY DEFINER` RPCs.
- **Authorization**: RLS + column grants. Clients cannot write subscriptions, keys or upvote counts directly,
  and cannot read `listings.base_url` (that would let them bypass the gateway).
- **Gateway**: fails closed if the store or Redis is down; strips consumer credentials and cookies; never follows
  redirects; only dials public IPs and pins the connection to the vetted IP (DNS-rebinding safe).
- **Web**: same-origin + JSON-only mutations (CSRF), same-site-only `next` redirects, security headers.
