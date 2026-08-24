@AGENTS.md

> **Antes de escribir código:** esta versión de Next.js (16.2.9) tiene breaking changes. Leé `node_modules/next/dist/docs/` — `middleware.ts` ya no existe, es `proxy.ts` en la raíz.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Lobo Burger**

Web de pedidos online de Lobo Burger, una hamburguesería de barrio en Lima, ya en
producción y cobrando soles reales en https://loboburger.com. El cliente es Jaime,
el dueño. La web ya vende: carta con fotos, carrito, checkout con Culqi embebido
(tarjeta y Yape), pedidos en Supabase y panel de administración. Este milestone
cierra los huecos que quedan entre "cobra" y "es un ecommerce completo y seguro"
para poder hacer marketing pago a los clientes que hoy ya consumen en el local.

**Core Value:** Que un pedido pagado siempre llegue a la cocina, con el precio correcto, y que
nadie pueda pagar cuando el local no puede cumplirlo.

### Constraints

- **Producción**: la web cobra plata real hoy — ningún cambio puede dejar el checkout roto ni perder pedidos durante el despliegue.
- **Presupuesto**: el negocio no está invirtiendo en este momento. Toda solución debe funcionar en free tier o ser gratis. Lo que cueste dinero (Supabase Pro, proveedor de SUNAT, WhatsApp Cloud API) se le presenta a Jaime como decisión suya, no se asume.
- **Legal**: el libro de reclamaciones (Ley N° 32495) no puede caerse. La boleta electrónica de SUNAT es obligatoria para venta a consumidor final y hoy no se emite.
- **Tech stack**: Next.js 16.2.9 App Router + TypeScript strict + Tailwind 4, Vercel, Culqi Checkout Custom (REST directo, sin SDK), Supabase. No introducir frameworks nuevos.
- **Free tier de Supabase**: minimizar lecturas por request. El menú se sirve de caché de Next con invalidación por tag, no se golpea la DB en cada carga de la carta.
- **Dependencias de Jaime**: `RESEND_API_KEY` + correo del negocio, RUC y razón social, precios reales de la carta, acceso a Meta Business. Bloquean partes del alcance, no todo.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.x (strict mode) - entire app (`app/`, `components/`, `lib/`) and server routes (`app/api/`)
- SQL - Supabase migrations (`supabase/migrations/*.sql`)
## Runtime
- Node.js v20.19.4 (local dev environment; no `.nvmrc`/`engines` field pinning a version in `package.json`)
- npm
- Lockfile: present (`package-lock.json`)
## Frameworks
- Next.js 16.2.9 - App Router (`app/`), React Server Components, API routes, server actions runtime
- React 19.2.4 / React DOM 19.2.4 - UI layer
- `middleware.ts` is deprecated in this version — renamed to **`proxy.ts`** at repo root (`proxy.ts`, exported function `proxy()`). Do not create a `middleware.ts` file; it will not be picked up. Consult `node_modules/next/dist/docs/` before assuming any other Next.js convention from training data.
- None detected. No Jest/Vitest/Playwright config, no `*.test.*`/`*.spec.*` files found in the repo.
- Tailwind CSS 4 (`@tailwindcss/postcss`) - styling, config via `app/globals.css` (no separate `tailwind.config.*`, per Tailwind 4 CSS-first config)
- ESLint 9 (flat config, `eslint.config.mjs`) - extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- shadcn CLI 4.12.0 + `components.json` - UI component scaffolding (style: `base-nova`, base color: `neutral`, icon library: `lucide`)
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` - class-composition utilities for the component system
## Key Dependencies
- `@supabase/supabase-js` 2.109.0 - database client (server-only usage, see `lib/supabase.ts`)
- `resend` 6.20.0 - transactional email for reclamaciones notifications (`app/api/reclamaciones/route.ts`)
- `leaflet` 1.9.4 + `@types/leaflet` - interactive delivery-location map (`components/delivery-map.tsx`)
- `lucide-react` 1.22.0 - icon set used throughout components
- `@base-ui/react` 1.6.0 - unstyled UI primitives underlying the shadcn component set
- Culqi Checkout Custom - loaded client-side via external script `https://js.culqi.com/checkout-js` (not an npm package; see `lib/culqi.ts`). No `culqi-node` SDK is used — the server charge call in `app/api/charge/route.ts` hits the Culqi REST API directly with `fetch`.
## Configuration
- `.env.local` (git-ignored, present) - local secrets
- `.env.example` - documents all required env vars with placeholder values (Spanish comments explain each)
- `.env.vercel` / `.env.vercel.production` (git-ignored, present) - exported Vercel env snapshots; existence noted only, contents not read (may contain real secret values)
- `NEXT_PUBLIC_CULQI_PUBLIC_KEY`, `CULQI_SECRET_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `RECLAMOS_EMAIL_TO`
- `ADMIN_USER`, `ADMIN_PASSWORD`
- `next.config.ts` - default Next config, no custom options set
- `tsconfig.json` - `strict: true`, `moduleResolution: "bundler"`, path alias `@/*` → repo root, `target: ES2017`
- `postcss.config.mjs` - Tailwind 4 PostCSS plugin
- `eslint.config.mjs` - flat config, Next core-web-vitals + TypeScript rules
## Platform Requirements
- Node.js (v20+ confirmed working locally)
- npm scripts: `npm run dev` (Next dev server), `npm run build`, `npm run start`, `npm run lint`
- Local Supabase CLI stack available via `supabase/config.toml` (project_id: `los-angeles`, Postgres major version 17) for local migration development
- Deployment target: Vercel (evidenced by `.env.vercel*` snapshot files and Next.js/Vercel-idiomatic project layout)
- Live domain: loboburger.com (per `app/layout.tsx` `SITE_URL` / metadata and OpenGraph config)
- External dependency at runtime: Culqi checkout script served from `js.culqi.com` (client) and Culqi REST API `api.culqi.com` (server)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- kebab-case for all `.ts`/`.tsx` files: `cart-context.tsx`, `orders-store.ts`, `delivery-map.tsx`, `location-bar.tsx`.
- Route folders follow Next.js App Router conventions: `app/api/charge/route.ts`, `app/checkout/page.tsx`, `app/checkout/layout.tsx`.
- Next 16 middleware file is `proxy.ts` at the project root (NOT `middleware.ts` — that convention is deprecated in this Next version, per the header comment in `proxy.ts`).
- camelCase throughout: `getMenuItem`, `saveOrder`, `initCulqiCheckout`, `buildWhatsAppUrl`.
- Domain-specific helper functions are named in Spanish when they describe a business concept: `codigoPedido()` (`app/api/charge/route.ts:28`), `direccionCompleta()` (`app/checkout/page.tsx:103`), `folioDe()` (`app/api/reclamaciones/route.ts:18`), `generateMockOrder()` mixes English (`app/admin/page.tsx:39`). There is no strict rule — Spanish names appear where the concept is domain/business-specific (pedido, folio, direccion), English where it's a generic programming concept (save, build, generate).
- camelCase for local variables and props: `totalCents`, `fulfillmentMode`, `payError`.
- SCREAMING_SNAKE_CASE for module-level constants: `MIN_CENTS`, `MAX_CENTS`, `MAX_QTY` (`app/api/charge/route.ts`), `STORAGE_KEY`, `WHATSAPP_NUMBER` (`lib/cart-context.tsx`), `CULQI_CONTAINER_ID` (`app/checkout/page.tsx`).
- Color/design-token constants are also SCREAMING_SNAKE_CASE and short: `PRIMARY`, `ACCENT`, `INK`, `MUTED`, `BORDER` (see Styling section below).
- PascalCase for types and type aliases: `MenuItem`, `Order`, `OrderStatus`, `CartItem`, `FulfillmentMode`, `DatosPedido`, `CulqiCheckoutParams`.
- Inline object types are used freely for local component state (e.g. the `errors` state shape in `app/checkout/page.tsx:46`) rather than being hoisted to a named type — named types are reserved for values that cross module boundaries (props, API payloads, store records).
## Code Style
- No Prettier config present (`.prettierrc*` absent). Formatting is manually consistent: double quotes, semicolons, 2-space indentation.
- No `.editorconfig` file.
- Dense, table-like alignment is used deliberately for parallel literal data — see the padded property alignment in `lib/menu.ts:22-38` (`MENU_ITEMS`) and `app/admin/page.tsx:13-16` (`statusConfig`) and `app/admin/page.tsx:64-70` (grouped `useState` declarations). When adding entries to these arrays/objects, match the existing column alignment rather than reformatting to single-space.
- ESLint via `eslint.config.mjs`, flat config format.
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` — no custom rule overrides beyond the default `.next/out/build` ignores.
- Run with `npm run lint` (maps to `eslint` in `package.json`).
- `tsconfig.json` has `"strict": true`. No `noUncheckedIndexedAccess` or other stricter-than-default flags.
## Import Organization
- `@/*` maps to project root (`tsconfig.json` `paths`). Always import internal modules as `@/lib/...` or `@/components/...`, never relative (`../../lib/...`) — no relative internal imports were found in `app/` or `components/`.
## Error Handling
## Logging
## Comments
- `lib/culqi.ts:151-153` — explains that Culqi's `settings` object silently fails to render (no error thrown) if any extra key like `description` is added, so the description is sent server-side instead.
- `app/checkout/page.tsx:364-368` — explains the exact pixel math for why the Culqi iframe container needs a fixed `height: 560` (498px card form + 509px Yape form + 40px padding), because the iframe uses `height:100%` internally and collapses without an explicit parent height.
- `proxy.ts:28-29` — explains that HTTP headers are ByteString/latin1, so a long dash or accented character in the `WWW-Authenticate` realm string causes a 500 instead of a login prompt.
- `lib/supabase.ts:8-9` — explains the client is constructed lazily (not at module load) because eager construction would crash the build in any environment where env vars aren't yet available.
- `app/api/charge/route.ts:1-5` — explains the core security rule (server recomputes the total, client never sends price) and references the exact past failure mode it prevents ("Antes el monto venia del cliente y se podia pagar S/3 un pedido de S/38").
## Function Design
## Module Design
## Styling Convention (and its tradeoff)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Client and server share one pricing module (`lib/menu.ts`) instead of duplicating a menu API — this is deliberate and load-bearing (see Cross-Cutting Concerns).
- All page components with interactivity are `"use client"`; there are no Server Components fetching data from Supabase directly (all data access goes through `/api/*` route handlers, called with `fetch` from client components).
- No ORM; Supabase JS client with raw `.from(table)` calls.
- No global state manager beyond React Context (`CartContext`); everything else (loyalty points, redemptions, legacy order log) is ad hoc `localStorage` read/write scattered per-page.
- Payment flow follows a "never trust the client for price" rule enforced only at `app/api/charge/route.ts`.
## Layers
- Purpose: Route pages, layouts, and shared UI (cart drawer/bar, navbar, sliders, map).
- Location: `app/*/page.tsx`, `app/*/layout.tsx`, `components/*.tsx`, `components/ui/*.tsx` (shadcn-style primitives)
- Contains: React 19 client components (nearly all marked `"use client"`), Tailwind v4 inline-style hybrid (colors as JS consts, not Tailwind color classes)
- Depends on: `lib/*` for state, pricing, and API calls
- Used by: end users (public pages) and restaurant staff (`/admin`, Basic Auth gated)
- Purpose: Cart state, menu data, sede/delivery geometry, Culqi client wrapper, Supabase client factory
- Location: `lib/*.ts`, `lib/cart-context.tsx`
- Contains: Pure functions (`lib/menu.ts`, `lib/sedes.ts`), a React Context provider (`lib/cart-context.tsx`), a browser-only payment wrapper (`lib/culqi.ts`), a server-only Supabase factory (`lib/supabase.ts`)
- Depends on: nothing else in-repo except `lib/orders-store.ts` (from `cart-context.tsx`)
- Used by: both `app/` (client) and `app/api/*/route.ts` (server) — `lib/menu.ts` and `lib/sedes.ts` are the only files imported from both sides
- Purpose: Payment charging, order persistence/retrieval, complaint intake, route protection
- Location: `app/api/charge/route.ts`, `app/api/admin/pedidos/route.ts`, `app/api/reclamaciones/route.ts`, `proxy.ts`
- Contains: Next.js Route Handlers (`POST`/`GET`/`PATCH` exports) and the Next 16 `proxy.ts` gate
- Depends on: `lib/menu.ts` (pricing), `lib/supabase.ts` (persistence), external Culqi/Resend APIs
- Used by: client components via `fetch`, and the platform itself (proxy runs before matched routes)
- Culqi Checkout (browser script `js.culqi.com/checkout-js`) + Culqi Charges REST API (server-side, secret key)
- Supabase Postgres (`pedidos`, `reclamaciones` tables, migrations in `supabase/migrations/`)
- Resend (transactional email for complaint notices, best-effort/non-blocking)
## Data Flow
### Primary Request Path — Order & Payment (the spine)
### Admin Route Protection
### Complaints Book Flow (secondary, legally-mandated)
- Cart/checkout: React Context (`CartContext`) + `localStorage` mirror, hydration-gated to avoid clobbering saved state on first render (`hydrated` flag, `lib/cart-context.tsx:53`)
- Loyalty/points ("La Manada"): entirely local — `app/puntos/page.tsx` reads/writes `localStorage` key `lobo_member` directly, no context, no server sync
- Admin panel: local `useState` refreshed by polling `fetch`, no context/store
## Key Abstractions
- Purpose: Single definition of menu items/prices consumed by both the rendering client and the charging server, so the two can never disagree on price
- Examples: `lib/menu.ts`
- Pattern: Plain exported array + `Map`-backed lookup (`getMenuItem`); explicitly documented as forbidden from using `"use client"` or DOM APIs (comment at top of file)
- Purpose: Avoid constructing the Supabase client (which throws if env vars are missing) at module-import time, which would break builds in environments without those vars yet
- Examples: `lib/supabase.ts` (`getSupabaseAdmin()`)
- Pattern: Module-level `let client: SupabaseClient | null`, constructed on first call
- Purpose: Leaflet touches `window` at import time and cannot be SSR'd
- Examples: `components/delivery-map.tsx`, imported via `next/dynamic(..., { ssr: false })` in `app/checkout/page.tsx:14-25`
- Purpose: Prevent price tampering (documented historical bug: "Antes el monto venia del cliente y se podia pagar S/3 un pedido de S/38")
- Examples: `app/api/charge/route.ts:57-77`
- Pattern: Client sends only `{id, qty}`; server re-derives every price from `lib/menu.ts` and rejects out-of-bounds totals
## Entry Points
- Location: `app/page.tsx`
- Triggers: `GET /`
- Responsibilities: Renders hero/promo slider, category-filtered menu grid, local reel, footer; hosts `MenuCard` add-to-cart interactions
- Location: `app/checkout/page.tsx`
- Triggers: `GET /checkout` (navigated to from cart drawer/bar)
- Responsibilities: Collects customer + delivery data, embeds Culqi payment form, orchestrates charge + order confirmation
- Location: `app/api/charge/route.ts`
- Triggers: `POST /api/charge` (called by `lib/culqi.ts` after tokenization)
- Responsibilities: Server-side price recalculation, Culqi charge, Supabase order insert
- Location: `app/admin/page.tsx` (+ `app/admin/layout.tsx` for `robots: noindex`)
- Triggers: `GET /admin` (Basic Auth required via `proxy.ts`)
- Responsibilities: Dashboard, order status management, client list, manual loyalty/redemption validation
- Location: `proxy.ts` (project root — Next 16 convention, replaces `middleware.ts`)
- Triggers: Every request matching `/admin/:path*` and `/api/admin/:path*` (see `config.matcher`)
- Responsibilities: HTTP Basic Auth enforcement before the route handler runs
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
### `"use client"` on nearly every page
## Error Handling
- Client-side form validation is manual per-field (`errs` object pattern, `app/checkout/page.tsx:52-63`, `app/api/reclamaciones/route.ts`'s server-side mirror of required-field checks)
- "Charge succeeded but persistence failed" is treated as a non-error: log and still return 200 with `chargeId`/`codigo` (`app/api/charge/route.ts:110-160`) — WhatsApp confirmation link (`buildWhatsAppUrl`, `lib/cart-context.tsx:37`) is the documented operational fallback
- `localStorage` reads are always wrapped in `try/catch` with silent fallback to empty/default state (`lib/cart-context.tsx:56-69`, `lib/orders-store.ts:31-35`, `app/puntos/page.tsx:53-59`)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
