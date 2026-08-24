# Technology Stack

**Analysis Date:** 2026-08-24

## Languages

**Primary:**
- TypeScript 5.x (strict mode) - entire app (`app/`, `components/`, `lib/`) and server routes (`app/api/`)

**Secondary:**
- SQL - Supabase migrations (`supabase/migrations/*.sql`)

## Runtime

**Environment:**
- Node.js v20.19.4 (local dev environment; no `.nvmrc`/`engines` field pinning a version in `package.json`)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.2.9 - App Router (`app/`), React Server Components, API routes, server actions runtime
- React 19.2.4 / React DOM 19.2.4 - UI layer

**Important Next.js 16 convention change (per `AGENTS.md`):**
- `middleware.ts` is deprecated in this version — renamed to **`proxy.ts`** at repo root (`proxy.ts`, exported function `proxy()`). Do not create a `middleware.ts` file; it will not be picked up. Consult `node_modules/next/dist/docs/` before assuming any other Next.js convention from training data.

**Testing:**
- None detected. No Jest/Vitest/Playwright config, no `*.test.*`/`*.spec.*` files found in the repo.

**Build/Dev:**
- Tailwind CSS 4 (`@tailwindcss/postcss`) - styling, config via `app/globals.css` (no separate `tailwind.config.*`, per Tailwind 4 CSS-first config)
- ESLint 9 (flat config, `eslint.config.mjs`) - extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- shadcn CLI 4.12.0 + `components.json` - UI component scaffolding (style: `base-nova`, base color: `neutral`, icon library: `lucide`)
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` - class-composition utilities for the component system

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.109.0 - database client (server-only usage, see `lib/supabase.ts`)
- `resend` 6.20.0 - transactional email for reclamaciones notifications (`app/api/reclamaciones/route.ts`)
- `leaflet` 1.9.4 + `@types/leaflet` - interactive delivery-location map (`components/delivery-map.tsx`)
- `lucide-react` 1.22.0 - icon set used throughout components
- `@base-ui/react` 1.6.0 - unstyled UI primitives underlying the shadcn component set

**Infrastructure:**
- Culqi Checkout Custom - loaded client-side via external script `https://js.culqi.com/checkout-js` (not an npm package; see `lib/culqi.ts`). No `culqi-node` SDK is used — the server charge call in `app/api/charge/route.ts` hits the Culqi REST API directly with `fetch`.

## Configuration

**Environment:**
- `.env.local` (git-ignored, present) - local secrets
- `.env.example` - documents all required env vars with placeholder values (Spanish comments explain each)
- `.env.vercel` / `.env.vercel.production` (git-ignored, present) - exported Vercel env snapshots; existence noted only, contents not read (may contain real secret values)

**Key configs required (names only, see INTEGRATIONS.md for grouping):**
- `NEXT_PUBLIC_CULQI_PUBLIC_KEY`, `CULQI_SECRET_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `RECLAMOS_EMAIL_TO`
- `ADMIN_USER`, `ADMIN_PASSWORD`

**Build:**
- `next.config.ts` - default Next config, no custom options set
- `tsconfig.json` - `strict: true`, `moduleResolution: "bundler"`, path alias `@/*` → repo root, `target: ES2017`
- `postcss.config.mjs` - Tailwind 4 PostCSS plugin
- `eslint.config.mjs` - flat config, Next core-web-vitals + TypeScript rules

## Platform Requirements

**Development:**
- Node.js (v20+ confirmed working locally)
- npm scripts: `npm run dev` (Next dev server), `npm run build`, `npm run start`, `npm run lint`
- Local Supabase CLI stack available via `supabase/config.toml` (project_id: `los-angeles`, Postgres major version 17) for local migration development

**Production:**
- Deployment target: Vercel (evidenced by `.env.vercel*` snapshot files and Next.js/Vercel-idiomatic project layout)
- Live domain: loboburger.com (per `app/layout.tsx` `SITE_URL` / metadata and OpenGraph config)
- External dependency at runtime: Culqi checkout script served from `js.culqi.com` (client) and Culqi REST API `api.culqi.com` (server)

---

*Stack analysis: 2026-08-24*
