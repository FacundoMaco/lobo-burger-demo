# External Integrations

**Analysis Date:** 2026-08-24

## APIs & External Services

**Payments:**
- Culqi (Peruvian payment gateway) - card + Yape checkout for the online ordering flow
  - Client-side: Checkout Custom widget loaded from `https://js.culqi.com/checkout-js` (NOT an npm SDK), initialized in `lib/culqi.ts` (`initCulqiCheckout`). Card data never touches the app's server — Culqi's embedded iframe handles PCI scope.
  - The widget is styled to match brand tokens via the `appearance` object in `lib/culqi.ts`; only `settings.{title,currency,amount,order}` keys are accepted by Culqi — any extra key (e.g. `description`) silently breaks rendering.
  - Payment methods enabled: `tarjeta` (card) and `yape`; `billetera`, `bancaMovil`, `agente`, `cuotealo` (installments) explicitly disabled.
  - Server-side: `app/api/charge/route.ts` receives the Culqi token from the client and creates the actual charge server-side via `fetch` to `https://api.culqi.com/v2/charges` with `Authorization: Bearer ${CULQI_SECRET_KEY}`.
  - Auth: `NEXT_PUBLIC_CULQI_PUBLIC_KEY` (browser-exposed, used to init the widget) and `CULQI_SECRET_KEY` (server-only, used for the charge API call).
  - **Security-critical pattern:** the browser only sends *what* was ordered (item ids + quantities); the server recomputes the total from `lib/menu.ts` before charging. Amount is never trusted from the client (`app/api/charge/route.ts` comment explains a prior vulnerability where the client-sent amount could be manipulated).
  - Amount bounds enforced server-side: `MIN_CENTS = 300` (Culqi's minimum), `MAX_CENTS = 50000`, `MAX_QTY = 20` per item (`app/api/charge/route.ts`).
  - Idempotency: `pedidos.culqi_charge_id` has a unique constraint; on Postgres `23505` unique-violation the route returns the existing order instead of creating a duplicate.
  - Test credentials note: per project memory, Culqi test account `DNGA9999` currently declines all test charges — verification pending on the Culqi account side (not a code issue).

## Data Storage

**Databases:**
- Supabase (hosted Postgres)
  - Connection: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (both server-only env vars)
  - Client: `@supabase/supabase-js`, wrapped in a **lazy singleton** getter `getSupabaseAdmin()` in `lib/supabase.ts` — the client is NOT instantiated at module load time (would break builds in environments without env vars yet); it's created on first call and cached in a module-level `client` variable.
  - This module must never be imported into a client component — it uses the service_role key, which bypasses RLS.
  - Local dev stack: `supabase/config.toml` (project_id `los-angeles`, Postgres 17), migrations in `supabase/migrations/`.

**Tables:**
- `pedidos` (`supabase/migrations/20260820000000_pedidos.sql`) - orders placed through checkout
  - Columns: `culqi_charge_id` (unique, for idempotency), `codigo` (unique order code, format `LB-<base36 timestamp>`), `cliente_nombre/telefono/email`, `delivery`, `direccion`, `lat`/`lng`, `items` (jsonb), `total_centimos`, `estado` (`pendiente|en_preparacion|listo|entregado|cancelado`)
  - RLS enabled with **no policies** — table is only ever touched via the service_role key from server code (`app/api/charge/route.ts`, `app/api/admin/pedidos/route.ts`). No client-side reads/writes possible.
  - Read/updated by the admin panel: `GET`/`PATCH` in `app/api/admin/pedidos/route.ts` (list last 200 orders, update `estado`).
- `reclamaciones` (`supabase/migrations/20260813000000_reclamaciones.sql`) - Libro de Reclamaciones (Peru consumer-complaint book, legally required per DS 011-2011-PCM)
  - Columns: `tipo` (`reclamo|queja`), `sede` (`Surquillo|SJM`), consumer identity/contact fields, `es_menor_edad`, `representante_nombre`, `bien_descripcion`, `monto_reclamado`, `detalle`, `pedido_concreto`, `estado` (`pendiente|respondido`)
  - RLS enabled with one policy: `anon` role may `INSERT` (`with check (true)`), no public `SELECT` policy — the public form (`app/api/reclamaciones/route.ts`) writes through the server using the service_role key (to read back the inserted row and build the folio number), never directly from the browser via the anon key.

**File Storage:**
- Local filesystem only — static assets served from `public/` (`public/images/`, `public/videos/`, `public/textures/`). No Supabase Storage or external object storage detected.

**Caching:**
- None. Orders are additionally mirrored to `localStorage` client-side under key `lobo_orders` (`lib/orders-store.ts`) as a legacy/local record, separate from the Supabase `pedidos` table.

## Authentication & Identity

**Auth Provider:**
- None (no Supabase Auth, no OAuth, no user accounts). The site is a public ordering site with no customer login.

**Admin Panel Protection:**
- Custom HTTP Basic Auth, implemented in `proxy.ts` (Next 16's replacement for `middleware.ts`)
  - Env vars: `ADMIN_USER`, `ADMIN_PASSWORD`
  - Matcher scope: `/admin/:path*` and `/api/admin/:path*` (`config.matcher` in `proxy.ts`)
  - Fails closed: if either env var is missing, the panel returns `503` instead of being left open
  - Known gotcha documented in code: HTTP headers are Latin1/ByteString — an em-dash or accented character in the `WWW-Authenticate` realm string causes a `500` instead of a credential prompt.

## Monitoring & Observability

**Error Tracking:**
- None. Errors are handled with `console.error` and best-effort fallback responses (e.g., `app/api/charge/route.ts` returns success to the client even if the Supabase insert fails after a successful Culqi charge, since the charge already occurred — operational backup is a WhatsApp contact button).

**Logs:**
- Server-side `console.error` only, relying on the hosting platform's log aggregation (Vercel).

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from `.env.vercel` / `.env.vercel.production` snapshot files; no explicit `vercel.json` found)

**CI Pipeline:**
- None detected (no `.github/workflows/`, no other CI config found).

## Environment Configuration

**Required env vars** (documented with Spanish explanatory comments in `.env.example`):
- `NEXT_PUBLIC_CULQI_PUBLIC_KEY` - Culqi public key, browser-exposed
- `CULQI_SECRET_KEY` - Culqi secret key, server-only, used to create charges
- `SUPABASE_URL` - Supabase project URL, server-only
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key, server-only (bypasses RLS)
- `RESEND_API_KEY` - Resend API key; if empty, reclamaciones still get recorded, just no email notification is sent
- `RECLAMOS_EMAIL_TO` - destination email for new reclamación notifications
- `ADMIN_USER` / `ADMIN_PASSWORD` - Basic Auth credentials gating `/admin`; without both, panel returns 503

**Secrets location:**
- `.env.local` (git-ignored) for local dev
- Vercel project environment variables for production (snapshotted in git-ignored `.env.vercel` / `.env.vercel.production` files — not read by this analysis)

## Webhooks & Callbacks

**Incoming:**
- None. No webhook receiver endpoints detected (Culqi charges are synchronous request/response from `app/api/charge/route.ts`, not webhook-driven).

**Outgoing:**
- Resend transactional email - fire-and-forget POST to Resend's API on new reclamación (`app/api/reclamaciones/route.ts`, sender `Lobo Burger <onboarding@resend.dev>`), wrapped in try/catch as best-effort (a failed email does not fail the reclamación submission).

## Third-Party Client-Side Assets

- OpenStreetMap tile server (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) - map tiles for the delivery-location picker (`components/delivery-map.tsx`), rendered via Leaflet, attribution `&copy; OpenStreetMap` required and present.
- Google Fonts (via `next/font/google`) - Bungee, Work Sans, JetBrains Mono, self-hosted/optimized by Next at build time (`app/layout.tsx`).

---

*Integration audit: 2026-08-24*
