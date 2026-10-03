# APIKUBO — Project Context

## Product Summary
APIKUBO is a global marketplace for APIs and AI Skills designed with a gateway-first architecture. It connects developers, agent builders, and API providers through a unified reverse-proxy and invocation layer that manages authentication, rate limiting, analytics, monetization, and automated skill execution.

## Stack & Folder Structure

### Monorepo Structure
```
/
├── PROJECT_CONTEXT.md
├── .env.example
├── gateway/                 # Python FastAPI reverse-proxy and invocation engine
│   ├── main.py              # Application entrypoint & /health route
│   └── requirements.txt     # Python dependencies (fastapi, uvicorn, httpx, redis)
└── web/                     # Next.js 14 frontend web application
    ├── app/
    │   ├── layout.tsx       # Root layout with font imports and metadata
    │   ├── page.tsx         # Landing page
    │   └── globals.css      # Tailwind CSS v4 styling & design tokens
    ├── package.json
    ├── postcss.config.mjs
    └── tsconfig.json
```

### Technology Stack
- **Web**: Next.js 14 (App Router), TypeScript, Tailwind CSS v4, `next/font`, `@supabase/ssr`, `@supabase/supabase-js`
- **Database / Auth**: Supabase PostgreSQL with RLS, Supabase Auth (Google OAuth)
- **Gateway**: Python 3.10+, FastAPI, Uvicorn, HTTPX, Redis

## Design Tokens (Tailwind CSS v4)
- **Background**: `#FAF8F3` (warm light neutral)
- **Surface**: `#FFFFFF` (pure clean white)
- **Text**: `#1C1917` (stone dark primary typography)
- **Muted**: `#78716C` (stone medium secondary typography)
- **Accent**: `#1F7A5A` (deep pine green brand primary)
- **Accent Hover**: `#17624A` (darker pine green interactive state)
- **Highlight**: `#D97706` (warm amber warning/highlight)
- **Border**: `#E7E5E4` (stone subtle structural border)

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
