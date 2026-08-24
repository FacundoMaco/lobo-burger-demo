# Codebase Structure

**Analysis Date:** 2026-08-24

## Directory Layout

```
los-angeles/                          # repo root (Next.js 16 project)
├── app/                              # App Router: pages, layouts, API routes
│   ├── admin/                        # Staff panel (Basic Auth gated)
│   │   ├── layout.tsx                # noindex metadata wrapper
│   │   └── page.tsx                  # dashboard/pedidos/clientes/validar tabs
│   ├── api/                          # Route Handlers (server-only)
│   │   ├── admin/pedidos/route.ts    # GET (list) / PATCH (status) — Supabase `pedidos`
│   │   ├── charge/route.ts           # POST — Culqi charge + order insert (the payment spine)
│   │   └── reclamaciones/route.ts    # POST — complaints book intake
│   ├── checkout/
│   │   ├── layout.tsx
│   │   └── page.tsx                  # checkout form + embedded Culqi payment
│   ├── libro-reclamaciones/          # Legally-mandated complaints book (public)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── promos/                       # Promotions page
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── puntos/                       # Loyalty program ("La Manada" / Wolfpoints), localStorage-only
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── terminos/page.tsx             # Terms & conditions (static)
│   ├── layout.tsx                    # Root layout: fonts, CartProvider, JSON-LD
│   ├── page.tsx                      # Home / carta (menu grid, hero promos)
│   ├── globals.css                   # Tailwind v4 entry + global styles
│   ├── robots.ts                     # robots.txt (file convention)
│   ├── sitemap.ts                    # sitemap.xml (file convention)
│   └── favicon.ico
├── components/                       # Shared React components (all client-facing)
│   ├── ui/                           # shadcn-style primitives (badge, button, card, dialog, progress, tabs)
│   ├── cart-bar.tsx                  # floating mini-cart summary
│   ├── cart-drawer.tsx               # full cart slide-out
│   ├── cheese-drip.tsx               # brand decoration (SVG)
│   ├── delivery-map.tsx              # Leaflet map picker, client-only (dynamic import)
│   ├── local-reel.tsx                # store photo/video reel
│   ├── location-bar.tsx              # sede/location banner
│   ├── navbar.tsx                    # top navigation
│   └── promo-slider.tsx              # hero carousel
├── lib/                              # Shared logic — imported by both client and server code
│   ├── cart-context.tsx              # CartProvider/useCart — React Context, localStorage-backed
│   ├── culqi.ts                      # browser-only Culqi Checkout Custom wrapper (tokenization)
│   ├── menu.ts                       # ISOMORPHIC menu/price source of truth (no "use client", no DOM)
│   ├── orders-store.ts               # legacy/local-only order log (localStorage `lobo_orders`) — NOT the real order store
│   ├── sedes.ts                      # sede list + haversine delivery-radius geometry
│   ├── supabase.ts                   # server-only lazy Supabase admin client factory
│   └── utils.ts                      # small helpers (cn/className merge, shadcn convention)
├── public/                           # Static assets
│   ├── images/menu/                  # product photos (.webp)
│   ├── textures/
│   └── videos/
├── supabase/
│   ├── migrations/                   # SQL migrations (source of truth for DB schema)
│   │   ├── 20260813000000_reclamaciones.sql
│   │   └── 20260820000000_pedidos.sql
│   └── .temp/                        # Supabase CLI local state (generated)
├── proxy.ts                          # Next 16 replacement for middleware.ts — gates /admin, /api/admin
├── next.config.ts                    # Next.js config (minimal, no custom options set)
├── next-env.d.ts                     # generated Next.js TS ambient types
├── package.json
└── .planning/                        # GSD planning artifacts (this directory's docs live in codebase/)
```

## Directory Purposes

**`app/`:**
- Purpose: Every route in the site, using Next.js 16 App Router file conventions.
- Contains: `page.tsx` (route UI), `layout.tsx` (route-scoped wrapper/metadata), `route.ts` under `api/` (server handlers).
- Key files: `app/page.tsx` (home/carta), `app/checkout/page.tsx` (payment spine), `app/admin/page.tsx` (staff panel).

**`app/api/`:**
- Purpose: All server-side logic that must not run in the browser — payment charging, Supabase writes with the service-role key, complaint intake.
- Contains: One `route.ts` per endpoint, exporting `GET`/`POST`/`PATCH` as named functions.
- Key files: `app/api/charge/route.ts` (recalculates price, charges Culqi, writes order).

**`components/`:**
- Purpose: Reusable UI shared across routes. Flat (non-nested) except for `ui/`.
- Contains: Feature components at top level (`cart-drawer.tsx`, `navbar.tsx`, etc.); generic shadcn-derived primitives under `ui/`.
- Key files: `components/cart-drawer.tsx`, `components/delivery-map.tsx` (only component requiring `next/dynamic` due to Leaflet's `window` access).

**`lib/`:**
- Purpose: Non-UI logic — state, data, and API clients. This is the layer that crosses the client/server boundary.
- Contains: React Context (`cart-context.tsx`), pure data modules (`menu.ts`, `sedes.ts`), thin external-service wrappers (`culqi.ts` for browser, `supabase.ts` for server).
- Key files: `lib/menu.ts` — the single most load-bearing file in the repo (imported by `app/page.tsx`, `app/checkout/page.tsx` indirectly via cart, and `app/api/charge/route.ts` directly).

**`supabase/migrations/`:**
- Purpose: Versioned SQL schema history for the two tables the app uses (`pedidos`, `reclamaciones`).
- Contains: Timestamp-prefixed `.sql` files, one per migration.
- Key files: `20260820000000_pedidos.sql` defines the `pedidos` table schema (columns referenced throughout `app/api/charge/route.ts` and `app/api/admin/pedidos/route.ts`, e.g. `culqi_charge_id`, `codigo`, `cliente_nombre`, `total_centimos`, `estado`).

**`public/images/menu/`:**
- Purpose: Product photography referenced by `image` field in `lib/menu.ts` entries.
- Generated: No (manually placed `.webp` files).
- Committed: Yes.

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout — wraps every page in `CartProvider`, mounts global `CartDrawer`/`CartBar`, sets fonts and site-wide metadata/JSON-LD.
- `app/page.tsx`: Home page / menu ("carta").
- `proxy.ts`: Request gate for `/admin/*` and `/api/admin/*` (Next 16 middleware replacement).

**Configuration:**
- `next.config.ts`: Next.js config (currently default/empty options object).
- `package.json`: Scripts (`dev`, `build`, `start`, `lint`), dependency versions (Next 16.2.9, React 19.2.4).
- Environment variables (not committed, read via `process.env` at runtime): `CULQI_SECRET_KEY`, `NEXT_PUBLIC_CULQI_PUBLIC_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `RECLAMOS_EMAIL_TO`.

**Core Logic:**
- `lib/menu.ts`: Price source of truth (client + server).
- `lib/cart-context.tsx`: Cart state machine.
- `app/api/charge/route.ts`: Payment + order-persistence logic.
- `lib/sedes.ts`: Delivery-zone geometry.

**Testing:**
- Not present. No test framework, test files, or `*.test.*`/`*.spec.*` files exist in the repository.

## Naming Conventions

**Files:**
- Route files follow Next.js App Router conventions exactly: `page.tsx`, `layout.tsx`, `route.ts`, `robots.ts`, `sitemap.ts` — never renamed.
- Non-route TypeScript/TSX files use `kebab-case`: `cart-context.tsx`, `delivery-map.tsx`, `local-reel.tsx`, `orders-store.ts`.
- `lib/` files are single-word or hyphenated nouns describing their domain (`menu.ts`, `culqi.ts`, `sedes.ts`, `supabase.ts`).

**Directories:**
- Route segments under `app/` are `kebab-case` and in Spanish where user-facing (`libro-reclamaciones`, `promos`, `puntos`, `terminos`), matching the site's Spanish-language audience.
- `components/ui/` isolates generic/shadcn-derived primitives from feature components living flat in `components/`.

**Code identifiers:**
- Spanish is used for domain/business terms throughout variable names, comments, and API payload keys (e.g., `codigoPedido`, `cliente_nombre`, `direccion`, `estado`, `pedido`, `reclamaciones`), while structural/technical terms stay in English (`CartContext`, `MenuItem`, `useCart`). New code in this domain should follow the same Spanish-for-business-terms convention.
- Color tokens are defined as local `const` (e.g., `const PRIMARY = "#F5A623"`) repeated per file rather than imported from a shared theme file — there is no central design-tokens module.

## Where to Add New Code

**New page/route:**
- Create `app/<route-name>/page.tsx` (+ `layout.tsx` if it needs route-specific metadata, following `app/promos/layout.tsx` as the minimal example).
- If it needs server-only data (Supabase), add a corresponding `app/api/<name>/route.ts` and `fetch()` it from the client component — this codebase does not fetch Supabase directly from Server Components; stay consistent with that pattern unless deliberately introducing Server Components (see ARCHITECTURE.md Anti-Patterns).

**New menu item / price change:**
- Edit `lib/menu.ts` only (`MENU_ITEMS` array). This single edit updates both the rendered carta and the server-side charge calculation — never hardcode a price elsewhere.

**New external integration (payment, email, etc.):**
- Server-only credentials/clients go in `lib/` following the `lib/supabase.ts` lazy-singleton pattern (construct on first call, throw clearly if env vars missing) — never at module top-level.
- Client-only SDK wrappers (loading external `<script>` tags) go in `lib/` following the `lib/culqi.ts` pattern (`loadXScript()` promise cache + typed `window` global).

**New admin feature:**
- Add a new tab inside `app/admin/page.tsx`'s `Tab` union and `navItems`, or a new `app/api/admin/<name>/route.ts` endpoint. Ensure it's reachable only through paths already covered by `proxy.ts`'s matcher (`/admin/:path*`, `/api/admin/:path*`) — no extra auth wiring needed if under those prefixes.

**New Supabase table:**
- Add a new timestamp-prefixed file to `supabase/migrations/` (format: `YYYYMMDDHHMMSS_description.sql`, matching the two existing files) rather than modifying the DB out-of-band.

**Utilities:**
- Shared, framework-agnostic helpers: `lib/utils.ts` (currently just the shadcn `cn()` class-merge helper).

## Special Directories

**`.next/`:**
- Purpose: Next.js build output.
- Generated: Yes.
- Committed: No (gitignored).

**`supabase/.temp/`:**
- Purpose: Supabase CLI local project state.
- Generated: Yes.
- Committed: No (expected gitignored — verify local `.gitignore` before committing changes here).

**`node_modules/next/dist/docs/`:**
- Purpose: Per `AGENTS.md`, this is the canonical reference for this specific (non-standard) Next.js 16 build's API differences from the conventional Next.js the model was trained on. Consult before writing new routing/data-fetching code, especially anything involving `proxy.ts` conventions or deprecated `middleware.ts` patterns.
- Generated: Yes (ships with the `next` package).
- Committed: No.

**`.planning/`:**
- Purpose: GSD workflow artifacts (phase plans, codebase maps — this document's home).
- Generated: Partially (docs like this one are written by mapping agents; other subdirectories may hold human/agent-authored planning files).
- Committed: Yes (project convention; verify against `.gitignore` if uncertain).

---

*Structure analysis: 2026-08-24*
