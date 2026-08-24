# Coding Conventions

**Analysis Date:** 2026-08-24

## Naming Patterns

**Files:**
- kebab-case for all `.ts`/`.tsx` files: `cart-context.tsx`, `orders-store.ts`, `delivery-map.tsx`, `location-bar.tsx`.
- Route folders follow Next.js App Router conventions: `app/api/charge/route.ts`, `app/checkout/page.tsx`, `app/checkout/layout.tsx`.
- Next 16 middleware file is `proxy.ts` at the project root (NOT `middleware.ts` — that convention is deprecated in this Next version, per the header comment in `proxy.ts`).

**Functions:**
- camelCase throughout: `getMenuItem`, `saveOrder`, `initCulqiCheckout`, `buildWhatsAppUrl`.
- Domain-specific helper functions are named in Spanish when they describe a business concept: `codigoPedido()` (`app/api/charge/route.ts:28`), `direccionCompleta()` (`app/checkout/page.tsx:103`), `folioDe()` (`app/api/reclamaciones/route.ts:18`), `generateMockOrder()` mixes English (`app/admin/page.tsx:39`). There is no strict rule — Spanish names appear where the concept is domain/business-specific (pedido, folio, direccion), English where it's a generic programming concept (save, build, generate).

**Variables:**
- camelCase for local variables and props: `totalCents`, `fulfillmentMode`, `payError`.
- SCREAMING_SNAKE_CASE for module-level constants: `MIN_CENTS`, `MAX_CENTS`, `MAX_QTY` (`app/api/charge/route.ts`), `STORAGE_KEY`, `WHATSAPP_NUMBER` (`lib/cart-context.tsx`), `CULQI_CONTAINER_ID` (`app/checkout/page.tsx`).
- Color/design-token constants are also SCREAMING_SNAKE_CASE and short: `PRIMARY`, `ACCENT`, `INK`, `MUTED`, `BORDER` (see Styling section below).

**Types:**
- PascalCase for types and type aliases: `MenuItem`, `Order`, `OrderStatus`, `CartItem`, `FulfillmentMode`, `DatosPedido`, `CulqiCheckoutParams`.
- Inline object types are used freely for local component state (e.g. the `errors` state shape in `app/checkout/page.tsx:46`) rather than being hoisted to a named type — named types are reserved for values that cross module boundaries (props, API payloads, store records).

## Code Style

**Formatting:**
- No Prettier config present (`.prettierrc*` absent). Formatting is manually consistent: double quotes, semicolons, 2-space indentation.
- No `.editorconfig` file.
- Dense, table-like alignment is used deliberately for parallel literal data — see the padded property alignment in `lib/menu.ts:22-38` (`MENU_ITEMS`) and `app/admin/page.tsx:13-16` (`statusConfig`) and `app/admin/page.tsx:64-70` (grouped `useState` declarations). When adding entries to these arrays/objects, match the existing column alignment rather than reformatting to single-space.

**Linting:**
- ESLint via `eslint.config.mjs`, flat config format.
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` — no custom rule overrides beyond the default `.next/out/build` ignores.
- Run with `npm run lint` (maps to `eslint` in `package.json`).
- `tsconfig.json` has `"strict": true`. No `noUncheckedIndexedAccess` or other stricter-than-default flags.

## Import Organization

**Order:**
Imports are grouped informally but consistently, top to bottom:
1. Framework/library imports (`next/dynamic`, `next/link`, `react`)
2. Internal absolute imports via `@/` alias (`@/lib/cart-context`, `@/components/navbar`)
3. Type-only imports, often on their own `import type { ... }` line directly after the value import from the same module area (see `app/checkout/page.tsx:9-10`)
4. Icon imports from `lucide-react` last

**Path Aliases:**
- `@/*` maps to project root (`tsconfig.json` `paths`). Always import internal modules as `@/lib/...` or `@/components/...`, never relative (`../../lib/...`) — no relative internal imports were found in `app/` or `components/`.

## Error Handling

**Server (route handlers) — validate, act, log, respond generically:**
Every route handler in `app/api/**/route.ts` follows the same shape:
1. Parse/validate the request body in a `try/catch`; on parse failure return `Response.json({ error: "Solicitud inválida" }, { status: 400 })`.
2. Validate business rules field-by-field, returning an explicit `4xx` status with a short Spanish user-facing message per failure (see `app/api/charge/route.ts:46-83`, `app/api/reclamaciones/route.ts:43-64`).
3. Perform the side-effecting operation (charge, insert). On failure, `console.error` a descriptive Spanish message that includes context (e.g. the charge id) followed by the raw error/exception object, then return a generic message to the client — never leak the raw error or provider error details to the response.
4. Prefer explicit HTTP status codes over defaults: `400` invalid input, `402` payment rejected, `500` server/config error.

Example pattern (`app/api/admin/pedidos/route.ts:38-49`):
```ts
try {
  const { error } = await getSupabaseAdmin().from("pedidos").update({ estado }).eq("codigo", codigo);
  if (error) throw error;
  return Response.json({ ok: true });
} catch (e) {
  console.error("No se pudo actualizar el pedido:", e);
  return Response.json({ error: "No se pudo actualizar el pedido" }, { status: 500 });
}
```

**Payment-already-happened case — never fail the response after money moved:**
`app/api/charge/route.ts:110-160` has an explicit rule: once the Culqi charge succeeds, a failure to persist the order in Supabase must NOT surface as an error to the client, because the customer already paid. It logs `console.error("Pedido cobrado pero no registrado:", ...)` and still returns a `200` with the charge id, relying on the WhatsApp confirmation button as the operational backup. When touching payment-adjacent code, preserve this "money already moved, never show a client-facing error past that point" rule.

**Idempotency via DB constraint:** `app/api/charge/route.ts:134-148` catches Postgres `23505` (unique violation) specifically to detect a duplicate charge submission and return the existing order instead of erroring or duplicating.

**Client-side:** `try/catch` around `fetch` calls with a generic Spanish fallback message (`"Error de conexión. Intenta de nuevo."` in `lib/culqi.ts:206`). `localStorage` reads/writes are wrapped in `try/catch` that silently no-ops with a Spanish comment explaining why (corrupted cart, incognito mode) — see `lib/cart-context.tsx:66-68` and `:79-81`.

**Never throw across the client/server payment boundary silently:** `initCulqiCheckout` in `lib/culqi.ts` resolves a discriminated union `CulqiCheckoutResult` (`success: true | false`) instead of throwing, so callers always get a typed outcome without needing try/catch.

## Logging

**Framework:** None — plain `console.error` only. No `console.log`/`console.warn` used for structured app logging (only 6 total `console.*` calls across `app/` and `lib/`, all `console.error`).

**Pattern:** `console.error("<Spanish description ending in colon>", <errorOrContextValue>)`. The description is written for whoever reads the server logs, and often states the operational consequence, not just "error occurred" — e.g. `"Pedido cobrado pero no registrado:"` tells the reader the charge succeeded but the DB write did not. Follow this pattern: state what happened and what state the system is now in, not just that an error was caught.

## Comments

**Written in Spanish, and used to record WHY — often documenting a trap that was already hit.** This is a deliberate house style, not incidental. Comments are sparse on "what the code does" and dense on "why it's written this unusual way." Representative examples:

- `lib/culqi.ts:151-153` — explains that Culqi's `settings` object silently fails to render (no error thrown) if any extra key like `description` is added, so the description is sent server-side instead.
- `app/checkout/page.tsx:364-368` — explains the exact pixel math for why the Culqi iframe container needs a fixed `height: 560` (498px card form + 509px Yape form + 40px padding), because the iframe uses `height:100%` internally and collapses without an explicit parent height.
- `proxy.ts:28-29` — explains that HTTP headers are ByteString/latin1, so a long dash or accented character in the `WWW-Authenticate` realm string causes a 500 instead of a login prompt.
- `lib/supabase.ts:8-9` — explains the client is constructed lazily (not at module load) because eager construction would crash the build in any environment where env vars aren't yet available.
- `app/api/charge/route.ts:1-5` — explains the core security rule (server recomputes the total, client never sends price) and references the exact past failure mode it prevents ("Antes el monto venia del cliente y se podia pagar S/3 un pedido de S/38").

**When adding a workaround, guard clause, or non-obvious constraint, write a Spanish comment stating what breaks without it and why** — do not just describe what the line does. This is the dominant, load-bearing commenting convention in this codebase; new code that touches Culqi, Supabase, headers, or money should follow it.

**Section-divider comments** appear in longer files to separate logical blocks, using a box-drawing character rule: `// ─── ValidarTab ───...` (`app/admin/page.tsx:51`, `:286`) and `// ── Confirmación ──` (`app/checkout/page.tsx:110`, `:152`, `:173`). Use this style for section breaks in files that mix multiple concerns (e.g. multiple response states in one page component).

**JSDoc/TSDoc:** Not used. Zero `/**` doc comments found. Types are expected to be self-documenting via their field names; behavioral notes go in `//` comments near the code they explain.

## Function Design

**Size:** No enforced limit. Route handlers run 30–130 lines including inline validation; this is treated as acceptable because the validation is sequential and linear per field, not because size is unconstrained everywhere. Page components (`app/checkout/page.tsx`, `app/admin/page.tsx`) are large (300+ lines) and are not split into smaller subcomponents unless a piece is reused (e.g. `ValidarTab` is broken out as its own function inside `admin/page.tsx` because it's a whole tab, not just to reduce size).

**Parameters:** Functions with more than 2-3 parameters take a single destructured options object with an explicit inline or named type, not positional args — see `initCulqiCheckout({ amount, email, pedido, containerId }: CulqiCheckoutParams)` in `lib/culqi.ts:139`.

**Return Values:** Prefer discriminated union return types over throwing for expected failure paths that a caller must branch on (`CulqiCheckoutResult`). Prefer throwing only for programmer-error conditions that should never happen in correct usage (`getSupabaseAdmin` throws if env vars are missing; `useCart()` throws if used outside `CartProvider`).

## Module Design

**Exports:** Named exports throughout; no default exports except React page/layout components (required by Next.js App Router file conventions — `export default function CheckoutPage()`).

**Barrel Files:** None. No `index.ts` re-export files found anywhere in `app/`, `components/`, or `lib/`. Every import references the concrete file directly via the `@/` alias.

**Client/server boundary:** Files that must never be imported by client components are marked with a comment stating so explicitly (`lib/supabase.ts:6` — "Nunca importar este archivo desde un componente cliente"), rather than relying purely on Next.js's server-only enforcement. `lib/menu.ts` is deliberately kept free of `"use client"` and DOM access because it is imported from both a client page (to render the menu) and a server route handler (to recompute the charge total) — see `lib/menu.ts:1-5`.

## Styling Convention (and its tradeoff)

Two parallel design-token systems coexist in this codebase — this is a real duplication, not an oversight, and should be understood before adding new UI:

1. **CSS custom properties in `app/globals.css`** (`:root` block, lines 44-94): defines `--color-bg`, `--color-primary`, `--color-accent`, `--color-ink`, plus a second overlapping set of `--lobo-*` tokens (`--lobo-yellow`, `--lobo-red`, etc.) and a third shadcn-oriented set (`--primary`, `--accent`, `--secondary`, ...). These back Tailwind's `@theme inline` mapping and a handful of utility classes (`.text-red-lobo`, `.card-lobo`, `.paper-texture`).

2. **Per-file inline hex constants** declared at the top of most page/component files: `const PRIMARY = "#F5A623"`, `const ACCENT = "#E63950"`, `const INK = "#241F1C"` (sometimes `MUTED`, `BORDER`), redeclared independently in at least 10 files: `app/page.tsx`, `app/checkout/page.tsx`, `app/terminos/page.tsx`, `app/libro-reclamaciones/page.tsx`, `components/navbar.tsx`, `components/cart-bar.tsx`, `components/cart-drawer.tsx`, `components/location-bar.tsx`, `components/promo-slider.tsx`, `components/delivery-map.tsx`, plus `lib/culqi.ts` for the Culqi iframe theme. These are then used both as inline `style={{ color: INK }}` objects AND combined with Tailwind utility classes on the same element (`className="font-bebas text-2xl mb-2" style={{ color: INK }}`).

**Tradeoff to be honest about:** the hex values are consistent across files (same `#F5A623` / `#E63950` / `#241F1C` everywhere observed), so there is no visible drift today — but there is no single source of truth. Changing the brand palette requires editing it in `app/globals.css` AND in every file that redeclares the constants; nothing enforces they stay in sync. When adding a new page/component, follow the existing pattern (redeclare the local `PRIMARY`/`ACCENT`/`INK` consts, mix inline `style` for hex-driven properties with Tailwind classes for layout/spacing/typography utilities) for consistency with the rest of the codebase, but be aware a palette change is a manual multi-file find-and-replace, not a token edit.

---

*Convention analysis: 2026-08-24*
