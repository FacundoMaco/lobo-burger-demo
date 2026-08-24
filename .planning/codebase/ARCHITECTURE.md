<!-- refreshed: 2026-08-24 -->
# Architecture

**Analysis Date:** 2026-08-24

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser, React 19)                │
├──────────────────┬──────────────────┬───────────────────────┤
│  Carta / Home     │  Cart Context     │   Checkout page       │
│  `app/page.tsx`   │  `lib/cart-      │   `app/checkout/      │
│                   │   context.tsx`    │    page.tsx`          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ reads prices      │ persists            │ tokenizes card
         ▼                   ▼ localStorage        ▼ in-browser (Culqi.js)
┌─────────────────────────────────────────────────────────────┐
│         lib/menu.ts  (isomorphic price source of truth)       │
│         imported by BOTH client components and server routes  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼ POST { tokenId, items: [{id,qty}], ... }  (no price sent)
┌─────────────────────────────────────────────────────────────┐
│              Server — Next.js Route Handlers                  │
│  `app/api/charge/route.ts`   `app/api/admin/pedidos/route.ts` │
│  `app/api/reclamaciones/route.ts`                              │
│  - recalculates total from lib/menu.ts                        │
│  - charges Culqi with CULQI_SECRET_KEY                        │
│  - writes/reads orders via lib/supabase.ts                    │
└────────┬────────────────────────────────────┬─────────────────┘
         │                                     │
         ▼                                     ▼
┌─────────────────────┐          ┌──────────────────────────────┐
│  Culqi Charges API   │          │  Supabase (Postgres)          │
│  (external, HTTPS)   │          │  tables: pedidos, reclamaciones│
└─────────────────────┘          └──────────────┬─────────────────┘
                                                  │ read back
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │  app/admin/page.tsx            │
                                   │  gated by `proxy.ts` (Basic Auth)│
                                   └──────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Menu source of truth | Defines items, prices, categories; used by both client render and server pricing | `lib/menu.ts` |
| Cart state | Client-side cart (add/remove/qty), fulfillment mode, address, localStorage persistence | `lib/cart-context.tsx` |
| Legacy/local order log | Writes a copy of the order to `localStorage` (`lobo_orders`); used by admin's mock-data helpers, NOT the real order feed | `lib/orders-store.ts` |
| Culqi tokenization | Loads Culqi Checkout Custom script, renders embedded card/Yape form, posts token + cart *contents* (not price) to `/api/charge` | `lib/culqi.ts` |
| Charge + persist order | Recalculates total server-side from `lib/menu.ts`, charges Culqi with the secret key, inserts row into Supabase `pedidos` | `app/api/charge/route.ts` |
| Supabase admin client | Lazily-constructed service-role client, server-only | `lib/supabase.ts` |
| Admin order feed | Reads/updates `pedidos` table for the panel | `app/api/admin/pedidos/route.ts` |
| Complaints book (Libro de Reclamaciones) | Validates legally-required fields, inserts into `reclamaciones`, best-effort emails via Resend | `app/api/reclamaciones/route.ts` |
| Route protection | Gates `/admin/*` and `/api/admin/*` with HTTP Basic Auth | `proxy.ts` |
| Sede/delivery geometry | Haversine distance, nearest sede, delivery radius check | `lib/sedes.ts` |
| Delivery map picker | Leaflet map, client-only (dynamic import, `ssr:false`) | `components/delivery-map.tsx` |
| Cart UI | Drawer (full cart), floating bar (mini summary) | `components/cart-drawer.tsx`, `components/cart-bar.tsx` |
| Loyalty program ("La Manada" / Wolfpoints) | Entirely client-side, `localStorage`-only, no server persistence | `app/puntos/page.tsx` |
| Admin panel | Dashboard, order list/status, client list (derived from orders), manual point/redemption validation | `app/admin/page.tsx` |

## Pattern Overview

**Overall:** Server-rendered Next.js App Router site with a thin set of server Route Handlers acting as a pricing/payment gateway in front of two external services (Culqi, Supabase). There is no traditional service/repository layer — each route handler talks to Supabase directly via a shared lazy client.

**Key Characteristics:**
- Client and server share one pricing module (`lib/menu.ts`) instead of duplicating a menu API — this is deliberate and load-bearing (see Cross-Cutting Concerns).
- All page components with interactivity are `"use client"`; there are no Server Components fetching data from Supabase directly (all data access goes through `/api/*` route handlers, called with `fetch` from client components).
- No ORM; Supabase JS client with raw `.from(table)` calls.
- No global state manager beyond React Context (`CartContext`); everything else (loyalty points, redemptions, legacy order log) is ad hoc `localStorage` read/write scattered per-page.
- Payment flow follows a "never trust the client for price" rule enforced only at `app/api/charge/route.ts`.

## Layers

**Presentation (`app/`, `components/`):**
- Purpose: Route pages, layouts, and shared UI (cart drawer/bar, navbar, sliders, map).
- Location: `app/*/page.tsx`, `app/*/layout.tsx`, `components/*.tsx`, `components/ui/*.tsx` (shadcn-style primitives)
- Contains: React 19 client components (nearly all marked `"use client"`), Tailwind v4 inline-style hybrid (colors as JS consts, not Tailwind color classes)
- Depends on: `lib/*` for state, pricing, and API calls
- Used by: end users (public pages) and restaurant staff (`/admin`, Basic Auth gated)

**Domain/shared logic (`lib/`):**
- Purpose: Cart state, menu data, sede/delivery geometry, Culqi client wrapper, Supabase client factory
- Location: `lib/*.ts`, `lib/cart-context.tsx`
- Contains: Pure functions (`lib/menu.ts`, `lib/sedes.ts`), a React Context provider (`lib/cart-context.tsx`), a browser-only payment wrapper (`lib/culqi.ts`), a server-only Supabase factory (`lib/supabase.ts`)
- Depends on: nothing else in-repo except `lib/orders-store.ts` (from `cart-context.tsx`)
- Used by: both `app/` (client) and `app/api/*/route.ts` (server) — `lib/menu.ts` and `lib/sedes.ts` are the only files imported from both sides

**API / server (`app/api/*/route.ts`, `proxy.ts`):**
- Purpose: Payment charging, order persistence/retrieval, complaint intake, route protection
- Location: `app/api/charge/route.ts`, `app/api/admin/pedidos/route.ts`, `app/api/reclamaciones/route.ts`, `proxy.ts`
- Contains: Next.js Route Handlers (`POST`/`GET`/`PATCH` exports) and the Next 16 `proxy.ts` gate
- Depends on: `lib/menu.ts` (pricing), `lib/supabase.ts` (persistence), external Culqi/Resend APIs
- Used by: client components via `fetch`, and the platform itself (proxy runs before matched routes)

**External services (not in-repo):**
- Culqi Checkout (browser script `js.culqi.com/checkout-js`) + Culqi Charges REST API (server-side, secret key)
- Supabase Postgres (`pedidos`, `reclamaciones` tables, migrations in `supabase/migrations/`)
- Resend (transactional email for complaint notices, best-effort/non-blocking)

## Data Flow

### Primary Request Path — Order & Payment (the spine)

1. User browses the menu, rendered from the isomorphic price list (`app/page.tsx:12` imports `MENU_ITEMS`/`CATEGORIES` from `lib/menu.ts`)
2. Adding an item calls `add()` from `useCart()` (`app/page.tsx:71` → `lib/cart-context.tsx:84`), which mutates React state and later persists `{items, fulfillmentMode, address}` to `localStorage` key `lobo_cart` (`lib/cart-context.tsx:72-82`)
3. `components/cart-bar.tsx` / `components/cart-drawer.tsx` read the same context to render the floating summary and drawer; drawer's CTA routes to `/checkout` (`components/cart-drawer.tsx:18`)
4. `app/checkout/page.tsx` collects name/phone/email/fulfillment/address, validates client-side (`handlePay`, `app/checkout/page.tsx:52-63`)
5. On submit, `initCulqiCheckout()` (`lib/culqi.ts:139`) loads Culqi's script, opens an embedded card/Yape form (`containerId` = `culqi-container`), and on token success POSTs to `/api/charge` with `{ tokenId, email, items: [{id, qty}], name, phone, delivery, address, lat, lng }` — **no price field is sent** (`lib/culqi.ts:190-207`, comment at line 195)
6. `app/api/charge/route.ts` (`POST`, line 32) re-derives every line price from `getMenuItem()` in `lib/menu.ts`, sums `totalCents`, validates bounds (`MIN_CENTS`/`MAX_CENTS`/`MAX_QTY`), then charges Culqi via `https://api.culqi.com/v2/charges` using `CULQI_SECRET_KEY` (line 86)
7. On successful charge, the route inserts a row into Supabase `pedidos` via `getSupabaseAdmin()` (`lib/supabase.ts`), handling the `23505` unique-violation case (duplicate charge retry) by returning the existing order instead of erroring (`app/api/charge/route.ts:134-148`)
8. The route ALWAYS returns success once Culqi has charged the card, even if the Supabase insert fails — the comment at `app/api/charge/route.ts:110-113` documents this as intentional: money moved, so the UI must not show failure; WhatsApp confirmation is the operational fallback
9. Back in the browser, `lib/culqi.ts` resolves `{success: true, chargeId, codigo}`; `app/checkout/page.tsx:86-94` calls `submitOrder()` from `CartContext`, which ALSO calls `saveOrder()` (`lib/orders-store.ts:17`) — a **separate, client-only `localStorage` copy** (key `lobo_orders`) distinct from the Supabase row. The confirmation screen displays `result.codigo` (the Supabase-issued code), overriding the local id (`app/checkout/page.tsx:94`)
10. `app/admin/page.tsx` polls `GET /api/admin/pedidos` every 10s (`app/admin/page.tsx:319-323`) which reads the `pedidos` table from Supabase — this is the actual multi-device order feed; `lib/orders-store.ts`'s `localStorage` copy is NOT read by the admin panel's real feed (only used by the "Agregar pedido de prueba" mock-data buttons, `app/admin/page.tsx:39-49`)
11. Staff advance order status via `PATCH /api/admin/pedidos` (`app/admin/page.tsx:325-332` → `app/api/admin/pedidos/route.ts:25`)

### Admin Route Protection

1. Any request to `/admin/*` or `/api/admin/*` is intercepted by `proxy.ts` (Next 16's replacement for `middleware.ts`) before reaching the route
2. Checks `ADMIN_USER`/`ADMIN_PASSWORD` env vars; if unset, blocks with 503 rather than defaulting open (`proxy.ts:14-16`)
3. Validates `Authorization: Basic` header against those env vars; on failure/absence, returns 401 with `WWW-Authenticate` (`proxy.ts:18-33`)

### Complaints Book Flow (secondary, legally-mandated)

1. `app/libro-reclamaciones/page.tsx` collects Anexo I fields (DS 011-2011-PCM) and POSTs to `/api/reclamaciones`
2. `app/api/reclamaciones/route.ts` validates all `REQUIRED` fields, sede enum, minor-consumer representative logic, and monto (line 28-64)
3. Inserts into Supabase `reclamaciones`, derives a folio from the row id/date (`folioDe`, line 18), and best-effort emails staff via Resend — failure to email does not fail the request (line 93-126)

**State Management:**
- Cart/checkout: React Context (`CartContext`) + `localStorage` mirror, hydration-gated to avoid clobbering saved state on first render (`hydrated` flag, `lib/cart-context.tsx:53`)
- Loyalty/points ("La Manada"): entirely local — `app/puntos/page.tsx` reads/writes `localStorage` key `lobo_member` directly, no context, no server sync
- Admin panel: local `useState` refreshed by polling `fetch`, no context/store

## Key Abstractions

**Isomorphic pricing module:**
- Purpose: Single definition of menu items/prices consumed by both the rendering client and the charging server, so the two can never disagree on price
- Examples: `lib/menu.ts`
- Pattern: Plain exported array + `Map`-backed lookup (`getMenuItem`); explicitly documented as forbidden from using `"use client"` or DOM APIs (comment at top of file)

**Lazy singleton server client:**
- Purpose: Avoid constructing the Supabase client (which throws if env vars are missing) at module-import time, which would break builds in environments without those vars yet
- Examples: `lib/supabase.ts` (`getSupabaseAdmin()`)
- Pattern: Module-level `let client: SupabaseClient | null`, constructed on first call

**Client-only dynamic import for DOM-dependent libs:**
- Purpose: Leaflet touches `window` at import time and cannot be SSR'd
- Examples: `components/delivery-map.tsx`, imported via `next/dynamic(..., { ssr: false })` in `app/checkout/page.tsx:14-25`

**Never-trust-the-client pricing guard:**
- Purpose: Prevent price tampering (documented historical bug: "Antes el monto venia del cliente y se podia pagar S/3 un pedido de S/38")
- Examples: `app/api/charge/route.ts:57-77`
- Pattern: Client sends only `{id, qty}`; server re-derives every price from `lib/menu.ts` and rejects out-of-bounds totals

## Entry Points

**Public site root:**
- Location: `app/page.tsx`
- Triggers: `GET /`
- Responsibilities: Renders hero/promo slider, category-filtered menu grid, local reel, footer; hosts `MenuCard` add-to-cart interactions

**Checkout:**
- Location: `app/checkout/page.tsx`
- Triggers: `GET /checkout` (navigated to from cart drawer/bar)
- Responsibilities: Collects customer + delivery data, embeds Culqi payment form, orchestrates charge + order confirmation

**Charge API:**
- Location: `app/api/charge/route.ts`
- Triggers: `POST /api/charge` (called by `lib/culqi.ts` after tokenization)
- Responsibilities: Server-side price recalculation, Culqi charge, Supabase order insert

**Admin panel:**
- Location: `app/admin/page.tsx` (+ `app/admin/layout.tsx` for `robots: noindex`)
- Triggers: `GET /admin` (Basic Auth required via `proxy.ts`)
- Responsibilities: Dashboard, order status management, client list, manual loyalty/redemption validation

**Route protection gate:**
- Location: `proxy.ts` (project root — Next 16 convention, replaces `middleware.ts`)
- Triggers: Every request matching `/admin/:path*` and `/api/admin/:path*` (see `config.matcher`)
- Responsibilities: HTTP Basic Auth enforcement before the route handler runs

**Static/meta entry points:**
- `app/robots.ts`, `app/sitemap.ts` — Next.js file-convention routes for `robots.txt`/`sitemap.xml`
- `app/layout.tsx` — root layout; wraps all pages in `CartProvider`, mounts global `CartDrawer`/`CartBar`, defines fonts (Bungee, Work Sans, JetBrains Mono) and JSON-LD restaurant schema

## Architectural Constraints

- **Threading:** Single-threaded Node.js request handling per Next.js Route Handler invocation; no worker threads or queues. The Culqi charge in `app/api/charge/route.ts` is a single synchronous `await` chain (charge → insert), so a slow Supabase insert directly extends response latency (mitigated by treating insert failure as non-fatal, not by making it async).
- **Global state:** `lib/supabase.ts` holds one module-level lazy singleton (`client`) shared across all server requests in the same process/lambda instance. `lib/culqi.ts` holds a module-level `scriptPromise` to dedupe script loading in the browser.
- **Dual order-persistence paths:** `lib/orders-store.ts` (`localStorage`, browser-only) and Supabase `pedidos` (via `/api/charge` and `/api/admin/pedidos`) are two independent stores that are NOT kept in sync. `CartContext.submitOrder()` always writes to the local one; only the Supabase one is read back by the real admin feed. Treat `lib/orders-store.ts` as legacy/demo-data plumbing, not the source of truth.
- **No server-side rendering of dynamic data:** Every page that shows Supabase-backed data (`app/admin/page.tsx`) fetches client-side via `fetch()`+`useEffect` polling rather than using a Server Component or `fetch` with revalidation. There is no `revalidatePath`/`revalidateTag` usage in the codebase.
- **Env-var-gated features degrade, not crash:** Missing `CULQI_SECRET_KEY` → 500 with a specific message (`app/api/charge/route.ts:34`); missing `ADMIN_USER`/`ADMIN_PASSWORD` → 503 (`proxy.ts:14`); missing `RESEND_API_KEY`/`RECLAMOS_EMAIL_TO` → complaint still saves, email just skipped (`app/api/reclamaciones/route.ts:96`).

## Anti-Patterns

### Silent dual order stores

**What happens:** `lib/cart-context.tsx`'s `submitOrder()` calls `saveOrder()` from `lib/orders-store.ts`, writing an order to `localStorage` under `lobo_orders`, in addition to the real order already inserted into Supabase by `/api/charge`. The two records can have different ids (local `LB-{timestamp}` vs. server `codigo` from `lib/supabase`'s insert) and are never reconciled.
**Why it's wrong:** Anyone reading `lib/orders-store.ts` in isolation would assume it is the order system; it is actually dead weight kept alive only because `app/admin/page.tsx`'s "Agregar pedido de prueba" button and `updateOrderStatus()` calls in `ValidarTab` still touch it.
**Do this instead:** When adding new order-related features, write against `app/api/admin/pedidos/route.ts` / the Supabase `pedidos` table. Do not extend `lib/orders-store.ts` — treat it as a demo/mock-data helper only.

### `"use client"` on nearly every page

**What happens:** All pages under `app/` except the two file-convention routes (`robots.ts`, `sitemap.ts`) are Client Components, including pages with no real interactivity needs at first paint (e.g., large parts of `app/puntos/page.tsx`, `app/promos/page.tsx`).
**Why it's wrong:** Loses Server Component benefits (smaller JS bundle, direct data access without a `fetch` round-trip) for pages that could fetch Supabase data server-side.
**Do this instead:** New data-driven admin/reporting pages should default to Server Components and only mark client boundaries at the interactive leaf (e.g., a status-change button), following the pattern Next 16's App Router encourages — check `node_modules/next/dist/docs/` per `AGENTS.md` before adding new fetching pages.

## Error Handling

**Strategy:** Route handlers wrap Supabase/external calls in `try/catch`, log via `console.error`, and return `Response.json({ error }, { status })`. Payment failures are surfaced as user-facing strings from Culqi's `user_message`.

**Patterns:**
- Client-side form validation is manual per-field (`errs` object pattern, `app/checkout/page.tsx:52-63`, `app/api/reclamaciones/route.ts`'s server-side mirror of required-field checks)
- "Charge succeeded but persistence failed" is treated as a non-error: log and still return 200 with `chargeId`/`codigo` (`app/api/charge/route.ts:110-160`) — WhatsApp confirmation link (`buildWhatsAppUrl`, `lib/cart-context.tsx:37`) is the documented operational fallback
- `localStorage` reads are always wrapped in `try/catch` with silent fallback to empty/default state (`lib/cart-context.tsx:56-69`, `lib/orders-store.ts:31-35`, `app/puntos/page.tsx:53-59`)

## Cross-Cutting Concerns

**Logging:** `console.error` only, no structured logging or external error tracking service configured.

**Validation:** Manual, per-route, duplicated between client (UX-level, immediate feedback) and server (security-level, in `app/api/charge/route.ts` and `app/api/reclamaciones/route.ts`). No shared schema/validation library (e.g., zod) is used.

**Authentication:** Only `/admin` and `/api/admin/*` are protected, via HTTP Basic Auth in `proxy.ts`. No user accounts, sessions, or JWTs anywhere in the app — "login" for the loyalty program (`app/puntos/page.tsx`) is just a `localStorage`-persisted profile keyed by phone/email, not a real auth system.

---

*Architecture analysis: 2026-08-24*
