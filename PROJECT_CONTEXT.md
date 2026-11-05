# APIKUBO — Project Context

## Product Summary
APIKUBO is a global marketplace for APIs and AI Skills designed with a gateway-first architecture. It connects developers, agent builders, and API providers through a unified reverse-proxy and invocation layer that manages authentication, rate limiting, analytics, monetization, and automated skill execution.

## Stack & Folder Structure

### Monorepo Structure
```
/
├── PROJECT_CONTEXT.md / README.md
├── gateway/                     # Python FastAPI reverse proxy & invocation engine
│   ├── main.py                  # uvicorn entrypoint (main:app)
│   ├── app/                     # config, keys, store (Supabase/memory), ratelimit, upstream (SSRF), main
│   └── tests/                   # pytest suite
├── web/                         # Next.js 14 App Router frontend
│   ├── app/                     # /, /explore, /listings/[slug], /submit, /dashboard, /login, /api/*
│   ├── components/              # UI (ui.ts holds shared class recipes)
│   ├── lib/                     # env, types, validation (shared rules), format, seed, auth-context
│   │   └── server/              # auth, repo (Supabase + in-memory demo), http helpers, key generation
│   └── supabase/migrations/     # 001 schema, 002 security hardening + RPCs
└── src/ + root package.json     # Google AI Studio Vite preview scaffold — NOT the production app.
                                 # It duplicates an early landing page and will drift; prefer web/.
```

### Build Status
- Done: gateway MVP (auth, limits, quotas, SSRF guard, metering), DB hardening, catalog, listing pages,
  publish flow, free-plan subscriptions, API key management, usage display.
- Next: paid plans (Stripe checkout + webhook writing subscriptions with the service role), provider-side
  request signing (so providers can reject calls that bypass the gateway), upvotes UI, provider analytics,
  OpenAPI ingestion, editing listings and plans after creation.

### Technology Stack
- **Web**: Next.js 14 (App Router) + React 18 (Next 14 does not support React 19), TypeScript, Tailwind CSS v4, `next/font`, `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`
- **Database / Auth**: Supabase PostgreSQL with RLS, Supabase Auth (Google OAuth)
- **Gateway**: Python 3.10+, FastAPI, Uvicorn, HTTPX, Redis

## Design Tokens (Tailwind CSS v4, `web/app/globals.css`)
Use the token utilities (`bg-surface`, `text-ink`, `text-muted`, `bg-accent`, `border-line`, `font-heading`), not hex values.
- **Background**: `#FAF8F3` (warm light neutral)
- **Surface**: `#FFFFFF` (pure clean white)
- **Ink** (`ink`): `#1C1917` (stone dark primary typography)
- **Muted**: `#78716C` (stone medium secondary typography)
- **Accent**: `#1F7A5A` (deep pine green brand primary)
- **Accent Hover**: `#17624A` (darker pine green interactive state)
- **Highlight**: `#B45309` (warm amber; darkened from #D97706 to pass WCAG AA on light backgrounds)
- **Line** (`line`): `#E7E5E4` (stone subtle structural border)

### Typography
- **Headings**: `Space Grotesk` (via `next/font/google`)
- **Body**: `DM Sans` (via `next/font/google`)
- **Code**: `JetBrains Mono` (via `next/font/google`)

## Development Rules & Security Standards
1. **TypeScript Strictness**: Strict type-checking enabled. Absolutely no `any` types.
2. **No Hardcoded Secrets**: Secrets, API keys, and credentials must never be committed or hardcoded.
3. **Environment Variables**: All environment variables must be loaded via `.env.local` for local development and comprehensively documented in `.env.example`.
4. **Gateway Security Invariant**:
   - **Never expose key_hash to the client.**
   - **Never trust client-side checks for limits or ownership.**
   - All authorization, quota tracking, and rate limits are strictly enforced server-side within the gateway service.
5. **Demo mode**: without Supabase credentials the web app uses seeded in-memory data and a cookie-based demo
   login. `isDemoAuthAllowed()` (lib/env.ts) must stay false in production builds.
6. **Consumers never see `listings.base_url`** — it is column-revoked for API roles; owners read it via RPC.
