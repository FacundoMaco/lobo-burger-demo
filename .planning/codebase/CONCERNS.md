# Codebase Concerns

**Analysis Date:** 2026-08-24

This document tracks the live, real-money Lobo Burger ordering site against the
pre-launch audit in `.context/INVESTIGACION-PEDIDOS-ONLINE.md`. Fase A of that
audit (client-trusted pricing, localStorage-only orders, no idempotency, open
admin panel) shipped in commit `eb9f243` (2026-08-20, "feat: precios en el
servidor, pedidos en base de datos y panel con clave") and is verified resolved
below with code evidence. Fase B/C items and additional findings from direct
code review follow.

## Resolved (Fase A — verified against code)

**1.1 Price decided by the browser — RESOLVED**
- Evidence: `app/api/charge/route.ts:57-77` recalculates `totalCents` server-side
  by looking up each `{id, qty}` line against `lib/menu.ts` via `getMenuItem()`.
  The client-supplied `items` array carries only `id`/`qty` (`lib/culqi.ts:118-126`,
  `app/checkout/page.tsx:73-82`); no client-supplied amount is trusted.
- Residual note: `MIN_CENTS`/`MAX_CENTS` bounds (S/3–S/500, `app/api/charge/route.ts:10-11`)
  are still a manual sanity check, not a menu-derived bound — fine for now, revisit if
  the menu grows combos above S/500.

**1.2 Orders lost if the browser closes — RESOLVED**
- Evidence: `app/api/charge/route.ts:110-133` inserts into Supabase table `pedidos`
  in the same request that creates the Culqi charge, before responding to the client.
  `app/api/admin/pedidos/route.ts` reads from the same table, so the admin panel is
  no longer scoped to one device's `localStorage`.
- Confirmed in `app/admin/page.tsx:293-317`: the `refresh()` function fetches
  `/api/admin/pedidos` and polls every 10s, replacing the old localStorage-only read.

**1.4 No idempotency — RESOLVED**
- Evidence: `supabase/migrations/20260820000000_pedidos.sql:5` — `culqi_charge_id text not null unique`.
  `app/api/charge/route.ts:134-148` catches Postgres `23505` (unique violation) and
  returns the existing order's `codigo` instead of creating a duplicate.

**3.2 Admin panel had no password — RESOLVED**
- Evidence: `proxy.ts` implements Basic Auth gated on `ADMIN_USER`/`ADMIN_PASSWORD`,
  matched to `/admin/:path*` and `/api/admin/:path*` (`proxy.ts:36-38`). Missing
  credentials fail closed with a 503 (`proxy.ts:14-16`) rather than leaving the
  panel open.

---

## Open Concerns (Fase B/C and beyond)

### 1. No Culqi webhook — payment confirmation depends on the browser

- Files: `app/api/charge/route.ts`, `lib/culqi.ts:190-214`
- Issue: the only path that writes a `pedidos` row is the client calling
  `POST /api/charge` after the Culqi widget resolves a token
  (`lib/culqi.ts:196-207`). There is no `app/api/culqi/webhook` route and no
  subscription to Culqi's `charge.succeeded` / `order.status.changed` events.
- Impact: if the tab closes, the network drops, or the device sleeps between
  tokenization and the `/api/charge` response, Culqi has a successful charge
  with no corresponding order — and no server-side path ever finds out. Culqi's
  own docs mark webhooks mandatory for asynchronous methods; Yape is enabled
  in `lib/culqi.ts:165-172` (`paymentMethods.yape: true`), which is exactly
  that asynchronous case.
- Fix approach: add `app/api/culqi/webhook/route.ts` subscribed to
  `charge.succeeded`, verify the Culqi signature, and upsert into `pedidos` by
  `culqi_charge_id` (the existing unique constraint already supports this as
  an idempotent upsert target).

### 2. Silent order-loss if the Supabase insert fails after a successful charge

- Files: `app/api/charge/route.ts:110-160`
- Issue: deliberate and commented tradeoff — after the Culqi charge succeeds,
  if `getSupabaseAdmin().from("pedidos").insert(...)` throws or returns a
  non-`23505` error, the route logs `"Pedido cobrado pero no registrado"` via
  `console.error` (lines 149, 158) and still returns `{ chargeId, codigo, total }`
  as success to the client.
- Impact: the customer sees a confirmed order and the WhatsApp fallback button
  (`app/checkout/page.tsx:132-141`), but the restaurant has no Supabase row for
  it unless the customer manually sends the WhatsApp message. There is no
  server-side retry, queue, or alert on this log line — it only exists in
  Vercel's function logs, which nobody is actively monitoring (see item 8).
- Fix approach: at minimum, alert (webhook/Slack/email) on this log line so a
  human catches it same-day; longer term this is subsumed by item 1 (a Culqi
  webhook gives a second, independent path to reconcile the charge).

### 3. No rate limiting on `/api/charge` — card-testing vector

- Files: `app/api/charge/route.ts`, `proxy.ts`
- Issue: `proxy.ts`'s Basic Auth matcher only covers `/admin/:path*` and
  `/api/admin/:path*` (`proxy.ts:37`). `/api/charge` has no auth, no per-IP
  throttling, and no CAPTCHA. The only limits are `MIN_CENTS`/`MAX_CENTS` and
  `MAX_QTY` (`app/api/charge/route.ts:10-12`), which bound the amount per
  attempt but not the attempt rate.
- Impact: a script can hammer the endpoint with stolen card numbers
  (card-testing/carding), generating fraud signals against the Culqi merchant
  account and potentially fees per failed attempt.
- Fix approach: add IP-based rate limiting (Vercel's Edge Config/KV, or a
  lightweight in-memory + Upstash Redis limiter) in front of `/api/charge`,
  and consider requiring a session/nonce from `/checkout` before allowing a
  charge attempt.

### 4. Supabase project on free tier — already caused a production 500

- Files: `lib/supabase.ts`, `app/api/reclamaciones/route.ts`, `app/api/charge/route.ts`, `app/api/admin/pedidos/route.ts`
- Issue: every server-side write/read (`pedidos`, `reclamaciones`) depends on
  `getSupabaseAdmin()` (`lib/supabase.ts:12-22`), which talks to a single free-tier
  Supabase project. Free-tier projects auto-pause after a period of inactivity.
  This has already happened once in production and took `/libro-reclamaciones`
  down with an HTTP 500 — a legally required feature under Ley N° 32495 (see
  `.context/attachments/FJYJBc/pasted_text_2026-08-13_17-53-18.txt` for the
  original legal requirement and penalty: multa de 1 UIT ≈ S/5,500).
- Impact: the same auto-pause risk now also threatens the payment/order path
  (`app/api/charge/route.ts`), not just reclamaciones — a paused project during
  a charge would hit the `catch` block described in item 2, i.e. successful
  charges with no order recorded, at scale, until someone notices.
- Fix approach: upgrade the Supabase project to a paid tier (removes
  auto-pause), or at minimum set up an uptime check that pings the project on
  a schedule to keep it warm and alerts on failure.

### 5. Business/legal gaps

- Files: `app/libro-reclamaciones/page.tsx:12-16`, `app/api/reclamaciones/route.ts`
- Issue: `NEGOCIO.razonSocial` and `NEGOCIO.ruc` are hardcoded placeholders —
  `"[PENDIENTE: razón social]"` and `"[PENDIENTE: RUC]"` — and render directly
  into the printed `constancia` (acknowledgment receipt) shown to consumers
  (`app/libro-reclamaciones/page.tsx:189-190`). There is no SUNAT electronic
  receipt (boleta electrónica) issued anywhere in the order flow.
- Impact: the libro de reclamaciones constancia is legally required to show
  accurate business identity; shipping `[PENDIENTE]` in production is a
  compliance gap on a feature that exists specifically to satisfy INDECOPI
  fiscalization criteria. Boleta electrónica is a separate, larger gap
  (SUNAT integration or manual daily resumen — decision pending the client's
  accountant per `.context/INVESTIGACION-PEDIDOS-ONLINE.md:63-64`).
- Fix approach: get RUC and razón social from the client and hardcode them in
  `app/libro-reclamaciones/page.tsx` before the next deploy (cheap, no design
  needed); track boleta electrónica as a separate, larger scoped work item.

### 6. Operational gaps — the web works but the operation breaks

- Files: `app/page.tsx`, `lib/menu.ts`, `app/checkout/page.tsx`
- No store hours: `app/page.tsx` and the checkout flow accept orders and
  payment at any hour — nothing gates ordering to business hours. A 4am order
  gets charged and recorded with no one to see it until the next shift.
- No sold-out flag: `lib/menu.ts`'s `MenuItem` type has no `available`/`stock`
  field, so every item in `MENU_ITEMS` is always orderable regardless of
  actual kitchen stock.
- No restaurant notification: nothing pushes a new `pedidos` row to the
  restaurant. The admin panel (`app/admin/page.tsx`) is pull-only — it polls
  Supabase every 10s (`app/admin/page.tsx:319-323`) but there is no sound,
  printer, or WhatsApp/SMS push when an order lands. Staff must have the tab
  open and watching.
- No delivery fee or order minimum: `app/checkout/page.tsx`'s "Resumen" block
  (lines 185-197) totals items only; delivery is a free toggle
  (`fulfillmentMode === "delivery"`) with no added fee or minimum-order check,
  even though `lib/sedes.ts` computes real delivery distance
  (`distanciaKm`/`sedeMasCercana`, up to `RADIO_DELIVERY_KM = 7.5`km) — the
  distance is used only to validate the zone, never to price it.
- No order status for the customer: after payment, the customer sees a single
  static confirmation screen (`app/checkout/page.tsx:111-150`) with no way to
  check status later; status changes only happen inside the Basic-Auth-gated
  admin panel (`app/admin/page.tsx:325-332`), invisible to the customer.

### 7. Dead-ish `lib/orders-store.ts` path still partially wired in

- Files: `lib/orders-store.ts`, `lib/cart-context.tsx:1-4,103-112`, `app/admin/page.tsx:1-6,39-49,77-107,125-156,492-497,550-555`
- Issue: `lib/orders-store.ts` is a `localStorage`-backed order store
  (`saveOrder`, `getOrders`, `updateOrderStatus` against key `lobo_orders`).
  Real orders now live in Supabase (verified above), and the actual order list
  shown in `app/admin/page.tsx` comes exclusively from `/api/admin/pedidos`
  (line 297), never from `getOrders()` — so `getOrders()` itself is now
  effectively unused/dead.
  However, `saveOrder`/`updateOrderStatus` are still live-called:
  - `lib/cart-context.tsx:103-112` (`submitOrder`) calls `saveOrder()` on
    every successful checkout, purely to build the local `Order` object used
    to render the confirmation screen and the WhatsApp fallback message
    (`app/checkout/page.tsx:85-94`, `buildWhatsAppUrl` in `lib/cart-context.tsx:37-42`).
    This writes a second, redundant copy of every real paid order into
    `localStorage['lobo_orders']` that is never read back for anything.
  - `app/admin/page.tsx` calls `saveOrder()` from `generateMockOrder()`
    (lines 39-49, wired to the "Agregar pedido de prueba" buttons at
    lines 492-497 and 550-555) — this seeds fake orders into the same
    `localStorage['lobo_orders']` key but they never appear in the panel
    (which reads Supabase), so the button is effectively inert/misleading in
    the current build.
  - `app/admin/page.tsx:94-96` calls `updateOrderStatus(orderId, "entregado")`
    inside `ValidarTab`'s loyalty flow — this also writes to the unused
    `localStorage['lobo_orders']` key, not to the Supabase `pedidos.estado`
    column that the panel actually displays and updates via
    `PATCH /api/admin/pedidos` (`app/api/admin/pedidos/route.ts:25-50`).
- Impact: no data-loss risk (Supabase is authoritative), but confusing/dead
  code: the "mark entregado" side-effect in the loyalty validator silently
  does nothing useful, the mock-order buttons in `/admin` don't do what they
  visually claim, and every real checkout does one extra unnecessary
  localStorage write.
- Fix approach: decide whether `lib/orders-store.ts` should keep existing
  purely as a local view-model helper (rename/scope it to that role,
  e.g. `buildLocalOrderView()` with no persistence) or be removed in favor of
  passing the Supabase-returned `codigo`/fields straight into the confirmation
  UI. Either way, delete the now-inert mock-order buttons and the dead
  `updateOrderStatus` call in `ValidarTab`.

### 8. No monitoring/alerting

- Files: none found — no `sentry`, `@vercel/analytics`, `posthog`, or similar
  package in `package.json`; no error-tracking SDK initialized in
  `app/layout.tsx`.
- Impact: errors like the "Pedido cobrado pero no registrado" log (item 2) or
  a checkout break only surface when a human notices — no automated alert
  exists for a broken payment flow, a Supabase pause (item 4), or elevated
  error rates.
- Fix approach: add Sentry (or Vercel's built-in log alerts) at minimum on
  the `/api/charge` and `/api/reclamaciones` routes.

### 9. No analytics for the upcoming marketing push

- Files: `app/layout.tsx` (no GA4/Meta Pixel script), no abandoned-cart
  capture in `lib/cart-context.tsx` (email is only collected at
  `app/checkout/page.tsx`, post-cart, and never sent anywhere before payment).
- Impact: per `.context/INVESTIGACION-PEDIDOS-ONLINE.md` Section 4, launching
  paid marketing without GA4/Meta Pixel means there's no way to attribute
  spend to sales; this must be in place before, not after, campaigns start.
- Fix approach: install GA4 and/or Meta Pixel in `app/layout.tsx`; consider
  capturing email earlier in the funnel (e.g. on cart-drawer open) to enable
  abandoned-cart follow-up.

### 10. Menu hardcoded in source — no way for the client to self-serve price changes

- Files: `lib/menu.ts`
- Issue: `MENU_ITEMS` is a static array in a file with an explicit code
  comment marking it as "server-only source of truth" (`lib/menu.ts:1-5`).
  Every price, description, or availability change requires editing this file
  and redeploying.
- Impact: the business owner (Jaime) cannot change a price — even a Sunday
  soda price bump — without a developer deploy. This is also noted as the
  structural root cause behind item 1.1's original vulnerability: as long as
  pricing truth lives in a source file instead of a database, there's no
  place for a future admin UI to write to.
- Fix approach: per the original audit's Fase C plan, move `MENU_ITEMS` into a
  Supabase table with a simple CRUD screen in `/admin` (already Basic-Auth
  protected via `proxy.ts`), and have `getMenuItem()` in `lib/menu.ts` (or its
  replacement) query that table instead of an in-memory array. This is a
  larger structural change — budget it as its own phase, not a quick fix.

### 11. Loyalty system (`/puntos`, admin "Validar") is fully client-side and disconnected from real orders

- Files: `app/puntos/page.tsx:56-171`, `app/admin/page.tsx:63-284`
- Issue: membership (`lobo_member`), redemption codes (`lobo_redemptions`),
  and points history all live in `localStorage`, keyed by whatever
  device/browser the customer or the staff member (in `ValidarTab`) happens to
  be using. There's no server table backing loyalty state, unlike `pedidos`
  and `reclamaciones`.
- Impact: a customer's points don't survive a new device, a cleared browser,
  or incognito mode; staff validating orders/redemptions on a shared admin
  device could see/modify the wrong customer's `lobo_member` record if
  multiple staff share one browser profile. Not a payment-integrity issue
  (no money changes hands here directly) but a data-durability and
  multi-device gap in the same shape as the pre-Fase-A orders problem.
- Fix approach: out of scope for the payment-critical fixes, but flag for a
  future phase — likely folds into the same Supabase migration that would
  carry the menu (item 10) and could reuse the `pedidos.codigo` reference
  already generated per order.

### 12. Culqi test-account payment gate (external, unresolved as of the last note)

- Files: `.context/DEPLOY.md`, referenced in project memory
  (`culqi-test-dnga9999.md`)
- Issue: `.context/DEPLOY.md:10-15` documents that the test Culqi account
  denied all charges with error code `DNGA9999`, including Culqi's own
  documented test-success card numbers, pending account verification with
  Culqi. This is external to the codebase (no code fix possible) but blocks
  end-to-end payment verification until resolved.
- Impact: cannot be fully verified from code whether this is still blocking;
  flagged here because it directly affects confidence in the payment path
  described in items 1-3 above. `.context/DEPLOY.md` itself is stale (still
  describes the pre-Fase-A localStorage-only order limitation as current
  in its checklist item 4), so treat its Culqi status note as unconfirmed —
  verify directly against the live Culqi panel before relying on it.
- Fix approach: not a code fix. Confirm current Culqi account verification
  status before the next real-money test, and delete/update the stale
  sections of `.context/DEPLOY.md` once Fase A's Supabase migration is
  reflected there.

---

## Fragile Areas

**`app/api/charge/route.ts` request/response contract:**
- Files: `app/api/charge/route.ts`, `lib/culqi.ts`
- Why fragile: the route trusts `email`/`name`/`phone` as free-form strings
  with only presence checks (`app/api/charge/route.ts:46-55`) — no format
  validation server-side (email format is only validated client-side in
  `app/checkout/page.tsx:56`). A malformed email still reaches Culqi's
  `email` field and the `pedidos.cliente_email` column.
- Safe modification: add server-side format validation for `email`/`phone`
  before charging, matching the client-side regex already used in
  `app/checkout/page.tsx:56`.
- Test coverage: none — no test suite exists in the repo (no `*.test.*`/`*.spec.*`
  files found, no test runner configured in `package.json`).

**`proxy.ts` Basic Auth realm string:**
- Files: `proxy.ts:28-33`
- Why fragile: explicitly documented in-code — HTTP headers are ByteString
  (latin1), so any accented character or em-dash in the `WWW-Authenticate`
  realm string causes Next to throw a 500 instead of prompting for
  credentials. The current realm (`'Basic realm="Lobo Burger Panel"'`) is
  safe, but any future edit to that string needs to stay ASCII-only.
- Safe modification: keep the realm string plain ASCII; if localization is
  ever needed, localize the login page instead of the WWW-Authenticate header.

## Test Coverage Gaps

**No automated tests anywhere in the repo:**
- What's not tested: `app/api/charge/route.ts` (price recalculation, min/max
  bounds, idempotency branch, Supabase-failure branch), `app/api/reclamaciones/route.ts`
  (required-field validation), `lib/sedes.ts` (`distanciaKm`/`sedeMasCercana`
  delivery-zone math).
- Files: entire repo — `package.json` has no test script and no test runner
  dependency (`jest`, `vitest`, etc. all absent).
- Risk: the payment-critical logic in `app/api/charge/route.ts` (server-side
  pricing, the exact fix for the S/3-for-S/38 exploit documented in the
  original audit) has no regression test, so a future refactor could
  silently reintroduce client-trusted pricing.
- Priority: High for `app/api/charge/route.ts`'s pricing/idempotency logic;
  Medium for `lib/sedes.ts` delivery-zone math (affects whether delivery is
  offered/blocked correctly, not money directly).

---

*Concerns audit: 2026-08-24*
