# Pitfalls Research

**Domain:** Restaurant online ordering / food-delivery ecommerce, Peru — adding payment webhooks, store hours, stock flags, kitchen notifications, delivery fees, ecommerce analytics, a DB-backed menu, public order-status links, rate limiting, and monitoring to an already-live, real-money Next.js + Culqi + Supabase site.
**Researched:** 2026-08-24
**Confidence:** MEDIUM — Culqi's public docs (docs.culqi.com) do not expose payload examples, signature/authentication mechanism, or a documented retry schedule for webhooks; several claims below are flagged LOW-confidence for that specific reason and the prevention strategy is written to be safe *regardless* of what Culqi's actual (undocumented) behavior turns out to be. Everything referencing this repo's code was read directly from source, not inferred.

---

## Critical Pitfalls

### Pitfall 1: Building the webhook for the wrong Yape flow

**What goes wrong:**
Culqi has **two different, non-interchangeable ways to accept Yape**, and they fire different webhook events with different ID spaces:

1. **Cargos Únicos — Token Yape** (`docs.culqi.com/.../cargo-unico/tokens-yape`): the customer types their Yape phone number + a 6-digit approval code (valid 2 minutes) *inside the Culqi widget*, which yields a `culqi.token`, exactly like a card. That token is POSTed to the merchant backend and charged synchronously against `POST /v2/charges` — same code path as a card, same `charge.succeeded` event, same `id` format (`chr_...`).
2. **Órdenes de Pago — Billeteras Móviles** (`docs.culqi.com/.../ordenes-de-pago/billetera-moviles`): the merchant pre-creates an `order` object server-side (`confirm: false`), the widget shows a QR, and the customer pays from the Yape app *possibly hours later*. Confirmation is **only** delivered via the `order.status.changed` webhook — Culqi's own docs call the webhook "obligatorio" for this path. The ID here is an `ord_...`, not a `chr_...`.

Culqi's Checkout Custom docs (`docs.culqi.com/.../checkout/checkout-custom`) state the `order` parameter passed into `settings` **is required to show the Yape option** — without it, Checkout Custom "solamente mostrará pago con tarjetas."

Read against this repo's code, `lib/culqi.ts:150-175` never passes an `order` into `settings` (only `title`/`currency`/`amount`, per the comment on `lib/culqi.ts:151-153`), and `lib/culqi.ts:190-214`'s `culqi.culqi` callback only ever branches on `culqi.token` — it never checks `culqi.order`. That is only consistent with flow (1), the token-based Cargos Únicos path. If that reading is wrong and Culqi's widget is silently falling back to something else, or if a future edit adds the `order` param naively, the webhook needs to listen for a completely different event (`order.status.changed`) and store a completely different ID (`ord_...` vs `chr_...`), and the existing `culqi_charge_id unique` idempotency key would not apply to it.

**Why it happens:**
Culqi's own documentation is split across two unrelated payment primitives that both happen to be labeled "Yape," and the Checkout Custom integration guide doesn't clearly say which one your specific config (`paymentMethods.yape: true` with no `order`) actually activates. It is very easy to build a webhook against the flow you assumed rather than the flow that is live.

**How to avoid:**
Before writing `app/api/culqi/webhook/route.ts`, do one real Yape test payment against the live/test Culqi checkout as currently configured and inspect: (a) whether `culqi.order` or `culqi.token` fires in `lib/culqi.ts:190`, and (b) the `id` prefix of the resulting object (`chr_` vs `ord_`) via the Culqi merchant panel. Only then decide whether the webhook subscribes to `charge.succeeded` (reuse the existing `culqi_charge_id` column) or needs a second nullable `culqi_order_id` column plus `order.status.changed`. Do not assume from docs alone — verify against the actual widget config in `lib/culqi.ts`.

**Warning signs:**
Yape orders that "work" in the UI but never trigger the new webhook in testing; a webhook handler that receives zero events during a live Yape test even though the customer's Yape app showed a successful debit.

**Phase to address:**
Culqi webhook implementation (milestone item: "webhook `charge.succeeded`") — must be the *first* thing verified before writing the handler, not an assumption baked into the design.

---

### Pitfall 2: Trusting the webhook payload instead of re-fetching from Culqi's API

**What goes wrong:**
Unlike Stripe, Culqi's public documentation does not describe an HMAC signature, a signing secret, or any other cryptographic authenticity mechanism for webhook deliveries (verified by fetching `docs.culqi.com/es/documentacion/pagos-online/webhooks/` directly — the page covers only how to *configure* a webhook URL in CulqiPanel, not how to verify it). If the webhook handler trusts the POST body's `amount`, `state`, or `email` fields at face value, anyone who discovers or guesses the endpoint URL can POST a fabricated `charge.succeeded` payload and get an order (or a Telegram kitchen alert) created for a charge that never happened.

**Why it happens:**
Teams coming from Stripe/PayPal assume all payment webhooks ship signature verification and skip checking; the surface area is small enough (one route) that it's easy to wire "if body says succeeded, mark paid" without a second thought.

**How to avoid:**
Treat the webhook payload as a **pointer, not a fact**. On receipt, extract only the ID (`chr_...` or `ord_...`), then call `GET https://api.culqi.com/v2/charges/{id}` (or the orders equivalent) with `CULQI_SECRET_KEY` server-side to fetch the authoritative amount/state directly from Culqi before writing anything to `pedidos`. This also solves Pitfall 3 (amount mismatch) for free, since the re-fetched amount is what gets compared against the recomputed menu total, exactly like `app/api/charge/route.ts:57-77` already does for the synchronous path. If Culqi's endpoint turns out to require no auth to check status (unlikely) or exposes a signature header once actually tested against the live panel, keep the re-fetch anyway — it costs one API call and closes the whole trust question regardless of what the docs do or don't say.

**Warning signs:**
A webhook handler with no outbound call back to `api.culqi.com`; a `pedidos` insert/upsert whose only inputs are values taken straight from `request.json()`.

**Phase to address:**
Culqi webhook implementation.

---

### Pitfall 3: Webhook and `/api/charge` racing to create two orders

**What goes wrong:**
For the synchronous token flow (cards and, per Pitfall 1, likely current Yape), the widget calls `POST /api/charge` (`lib/culqi.ts:197-204`) right after Culqi issues the token — this already creates the Culqi charge *and* attempts the `pedidos` insert in the same request (`app/api/charge/route.ts:86-160`). If a `charge.succeeded` webhook also fires (Culqi sends webhooks for all charge events, not only the asynchronous ones) and the webhook handler independently tries to insert a `pedidos` row for the same `culqi_charge_id`, you get two write paths racing for the same order. The existing `unique` constraint on `culqi_charge_id` (`supabase/migrations/20260820000000_pedidos.sql:5`) and the `23505` handling in `app/api/charge/route.ts:134-148` already protect against a literal duplicate row — **but only if the webhook handler uses the exact same upsert-on-conflict pattern**. A naive `insert()` in the webhook route without catching `23505` (or without an explicit `upsert(..., { onConflict: "culqi_charge_id" })`) will throw on the second writer and, if unhandled, could return a 5xx to Culqi — triggering retries (see Pitfall 4) or silently dropping the event depending on how the route is written.

**Why it happens:**
The webhook is designed in isolation as "the missing piece," without re-reading how `/api/charge` already handles double-writes for its own doubleclick/retry case. It's easy to forget the webhook is now a *second, concurrent* writer to a row the synchronous path might also be writing at nearly the same instant.

**How to avoid:**
Use the exact same idempotent-upsert shape in the webhook handler as `app/api/charge/route.ts:116-148` — `insert(...).select(...)`, catch `23505`, and on conflict read back the existing row instead of erroring. Whichever writer (the browser's `/api/charge` call or the webhook) arrives first "wins" the insert; the second one is a no-op that still returns success. Never have the webhook route overwrite fields (status, total) that the synchronous path already set from data it independently derived — the webhook's job is to *guarantee the row exists*, not to be the sole owner of order state.

**Warning signs:**
Two `pedidos` rows for the same order visible in `/admin`; Postgres unique-violation errors in webhook route logs that aren't caught.

**Phase to address:**
Culqi webhook implementation — write it as a reuse of the existing upsert pattern in `app/api/charge/route.ts`, not a fresh insert.

---

### Pitfall 4: Assuming a specific Culqi retry schedule and building brittle recovery around it

**What goes wrong:**
Culqi's official webhook docs (as published) do not state a retry count, retry interval, timeout window, or the exact HTTP status codes that count as "success" vs. "trigger a retry." (Search results surfaced a specific-looking retry schedule — immediate, +1min, +10min, +30min, +1h — but it could not be confirmed as belonging to Culqi's own documentation rather than a different payments platform; treat it as unverified.) A team that hardcodes assumptions like "Culqi retries 5 times over 2 hours, so if I haven't heard back by then I can assume it failed" is building on a number nobody can currently verify against Culqi's own docs.

**Why it happens:**
Under deadline pressure, an unverifiable detail like exact retry timing gets treated as fact because *some* number was found somewhere, rather than flagged as unknown.

**How to avoid:**
Design the webhook handler to be safe for **any** retry policy: always return `200` only after the row exists (insert or confirmed-duplicate), return a non-2xx on genuine failure (e.g. Supabase down) so Culqi's own retry logic — whatever it actually is — has a chance to recover, and never build time-based "give up and assume it failed" logic. If reconciliation is needed, do it by *polling Culqi's API for charges without a matching `pedidos` row* on a daily cron (this also strengthens the existing "Pedido cobrado pero no registrado" gap in `app/api/charge/route.ts:149,158`), not by reasoning about retry timing.

**Warning signs:**
Code comments or logic referencing a specific number of retries/minutes without a citation to a live-verified Culqi source.

**Phase to address:**
Culqi webhook implementation; folds into the "alert when a charge succeeds but no order is saved" milestone item.

---

### Pitfall 5: Order-status codes are guessable, not just enumerable

**What goes wrong:**
`codigoPedido()` (`app/api/charge/route.ts:28-30`) generates codes as `` `LB-${Date.now().toString(36).toUpperCase()}` `` — a base-36 encoding of the server's millisecond timestamp at insert time. This is **not enumerable in the classic sequential-integer sense, it's worse: it's a monotonically increasing, low-entropy value directly derived from wall-clock time**. Anyone who places one order and notes the response time can compute the approximate code range for orders placed minutes before or after theirs, and brute-force `/pedido/LB-XXXXX` for nearby codes with almost no search space — no auth required once this milestone ships public `/pedido/[codigo]` pages showing name, phone, address, and order contents. This is a direct Ley 29733 exposure (personal data banks require consent and security measures; leaking one customer's name/phone/address to another is exactly the kind of incident that law targets) and a trivial reputational risk for a single-owner business (a competitor or a curious customer could watch order volume in real time).

**Why it happens:**
`codigoPedido()` was designed to be a human-friendly order reference (short, sortable, printable on a receipt), not a security token — a reasonable choice when it was only ever shown back to the same customer who placed the order and read by staff behind Basic Auth. Making it the URL key for an unauthenticated public page repurposes it into something it was never designed to be.

**How to avoid:**
Do not use `codigo` as the public lookup key as-is. Options, cheapest first: (a) append a random, unguessable suffix to `codigo` for the public URL only (e.g. a separate `public_token` column, `crypto.randomUUID()` or similar, stored alongside `codigo` and never derived from it) and keep `codigo` as the short human reference shown/printed; (b) require the customer's phone number (last 4 digits or full) as a second factor on the `/pedido/[codigo]` page before revealing details. (a) is simpler and doesn't add friction. Either way, the public page must only ever be looked up by the new unguessable token, never by `codigo` alone.

**Warning signs:**
A migration that reuses the existing `codigo` column directly as the route param for `/pedido/[codigo]` with no additional secret component.

**Phase to address:**
Public order-status link (`/pedido/[codigo]`) — must be designed before the route is built, since retrofitting a token after the URL scheme ships means every previously-shared link breaks or stays guessable forever.

---

### Pitfall 6: Delivery radius validation stays client-only while the fee goes server-side

**What goes wrong:**
`lib/sedes.ts` already implements `distanciaKm`/`sedeMasCercana`/`RADIO_DELIVERY_KM = 7.5` correctly, but `app/api/charge/route.ts` never imports or calls any of it — the route accepts `body.lat`/`body.lng` (`app/api/charge/route.ts:126-127`) and stores them verbatim with **no server-side check** that the address is actually within the deliverable radius. The zone check today lives entirely in the client-side map component. If the delivery-fee work only adds a fee calculation (e.g. "free above S/60, else flat S/8") without *also* moving the 7.5km zone check into `app/api/charge/route.ts`, two new failure modes open up: a manipulated/absent `lat`/`lng` from the browser gets charged the flat in-zone fee for an address the restaurant can't actually reach, and — separately — the fee itself, if computed from a client-supplied distance rather than a server-recomputed one, reintroduces exactly the class of bug the original S/3-for-S/38 fix eliminated for item pricing.

**Why it happens:**
The delivery fee item reads as "add a fee," and it's easy to bolt a `deliveryFee` calculation onto the existing total without revisiting whether the geography that fee depends on is actually verified server-side — especially since `lib/sedes.ts` already "looks done" (it exists, it's tested against the map UI, it has the right constant).

**How to avoid:**
In the same change that adds the delivery fee, call `sedeMasCercana({ lat, lng })` from `app/api/charge/route.ts` using the server-received `lat`/`lng`, reject the charge if `!dentroDeZona`, and derive the fee from the server-computed `km`/`sede`, never from anything the client sends about distance or fee amount. Treat this as one unit of work, not two.

**Warning signs:**
`lib/sedes.ts` imported anywhere under `app/` but not in `app/api/charge/route.ts`; a `deliveryFee` field arriving in the `POST /api/charge` body.

**Phase to address:**
Delivery fee + order minimum.

---

### Pitfall 7: Stale-price race between the DB-backed menu cache and the charge endpoint

**What goes wrong:**
Once `MENU_ITEMS` moves from `lib/menu.ts` into a Supabase table read through Next's `revalidate` + tag-based cache (per the milestone decision), two different staleness bugs are possible depending on which side lags:
1. **Cache serves an old price on the storefront, but `/api/charge` reads live and charges the new one.** A customer sees S/25 in the cart, confirms, and is charged S/28 after an admin price bump — a chargeback/dispute magnet, and a direct hit to trust for a single-owner brand.
2. **The reverse — `/api/charge` itself reads through a stale cache layer** if `getMenuItem()`'s replacement accidentally shares the same cached fetcher as the public menu page instead of querying Supabase directly (or with `no-store`/short-lived cache) — this would silently resurrect the original client-trusted-price class of bug, just moved one layer down (now the *cache* decides the price instead of the browser).

**Why it happens:**
"Cache the menu for reads, invalidate on admin edit" sounds like one concern, but there are really two different consumers of menu data (the storefront's display price, and the charge endpoint's ground truth) with different staleness tolerances, and it's tempting to reuse one cached accessor for both because it's already written.

**How to avoid:**
`/api/charge`'s price lookup must never share a cache key/tag with the public-facing menu fetch, or must use `revalidateTag` synchronously on every admin price/sold-out edit *before* the edit's HTTP response returns (so there is no window where the storefront can render a stale price after the admin already believes the change is live). Simplest safe pattern for a ~30-row table on Supabase free tier: cache the *public menu display* with `revalidate` + tag invalidation (cheap, few reads), but have the charge route query Supabase directly with no cache (it's already one request per checkout, not per page view, so the extra read is negligible against free-tier limits). Add a `next: { revalidate: 0 }` or direct Supabase client call in the charge path, explicitly, so a future refactor can't accidentally make it share the public cache.
Additionally, display the server-confirmed total back to the customer on the confirmation screen (already true today via `data.codigo`/derived total in `app/checkout/page.tsx`) so any mismatch between what was shown pre-payment and what was charged is at least visible immediately, not discovered later.

**Warning signs:**
`getMenuItem()`'s replacement importing the same cached data-access function used by the storefront's menu-rendering path; no `revalidateTag` call in the admin price-edit route handler.

**Phase to address:**
Menu moved to Supabase + cache with revalidate/tag invalidation.

---

### Pitfall 8: Duplicate `purchase` events inflate GA4/Meta reporting and mislead ad spend

**What goes wrong:**
The natural implementation fires `purchase` client-side on the checkout confirmation screen (`app/checkout/page.tsx`) — but once the Culqi webhook exists as a second, independent confirmation path (Pitfall 1-4), it becomes tempting to *also* fire `purchase` server-side from the webhook "to be safe." Doing both without deduplication double-counts every order that goes through the synchronous path (i.e., every card payment, and likely Yape per Pitfall 1) in both GA4 and Meta, inflating reported revenue and — worse for a small paid-ads budget — making ROAS look better than it is, which leads to overspending on underperforming campaigns.

**Why it happens:**
"Fire the event where the confirmation happens" gets applied twice: once on the client because that's the obvious place, and once from the webhook because it feels more "reliable" (server-side, survives ad blockers). Both instincts are individually reasonable; together they double-fire.

**How to avoid:**
Pick one source of truth for the `purchase` event given this app's actual architecture: since the `pedidos` insert already happens synchronously inside `/api/charge` (`app/api/charge/route.ts:116-133`) for the vast majority of orders, fire `purchase` **client-side only, on the confirmation screen, gated on a successful `/api/charge` response** — do not also fire it from the webhook. If the webhook ever creates a `pedidos` row that the client-side path never reached (the actual "browser died" case this milestone is meant to cover), that specific order will legitimately not get a client-side `purchase` event — accept that as a known, small gap rather than adding server-side firing and risking double-counting the 99% case. If server-side firing is added later (e.g. via Meta Conversions API for better match quality), it must reuse a stable `transaction_id`/`event_id` equal to `codigo` or `culqi_charge_id` on both the client `gtag`/`fbq` call and the server call so GA4/Meta dedupe them — this is standard Meta/GA4 behavior (same `event_id` within a 48h window is deduplicated) but requires the ID to be threaded through both call sites deliberately, not generated independently on each side.

**Warning signs:**
A `purchase`/`Purchase` call inside `app/api/culqi/webhook/route.ts` in addition to one in `app/checkout/page.tsx`; no shared transaction/event ID between the two.

**Phase to address:**
GA4 + Meta Pixel ecommerce events — decide the single firing point before writing either the client or webhook code, not after both exist.

---

### Pitfall 9: Store hours computed in server-local time instead of America/Lima

**What goes wrong:**
Vercel's serverless/edge functions run in UTC regardless of where the business is. Peru is UTC-5 with no DST. Any "is the store open right now" check written as `new Date().getHours()` or similar, evaluated on the server, compares against UTC hours — a store configured as "open 11:00–22:00" would actually be gated against 11:00–22:00 UTC, i.e. 06:00–17:00 Peru time, silently shifting the whole schedule by 5 hours. This is exactly the kind of bug that passes local testing (a developer's machine is often already in a Peru-adjacent or arbitrary timezone) and only surfaces in production against real Vercel infrastructure.

**Why it happens:**
`new Date()` "just works" in local dev because the developer's machine timezone happens to mask the bug; Vercel's runtime timezone is easy to forget is always UTC unless explicitly handled.

**How to avoid:**
Never compare against server-local wall-clock time. Convert to `America/Lima` explicitly wherever "is it open" logic runs — e.g. `Intl.DateTimeFormat` with `timeZone: "America/Lima"`, or compute using a fixed UTC-5 offset (safe here specifically *because* Peru has no DST — this shortcut would be wrong in almost any other country). Apply the same rule anywhere else time-of-day matters later (kitchen notification timestamps, order status timestamps shown to the customer).

**Warning signs:**
Any `new Date().getHours()`, `.getDay()`, or similar without an explicit `timeZone` conversion in the store-hours or order-gating code.

**Phase to address:**
Store business hours.

---

### Pitfall 10: "Closed" and "temporarily paused" collapse into one flag, breaking legitimate late-night edge cases

**What goes wrong:**
A single boolean "is open" derived purely from a weekly schedule table doesn't capture two operationally different situations: (a) the schedule says closed (it's 3am, nobody's there) vs. (b) the schedule says open but the kitchen is unexpectedly slammed/out of gas/short-staffed and Jaime needs to stop taking orders *right now* without touching the weekly hours. Building only the schedule-based check means every unexpected closure (a burst pipe, a broken fryer) either requires a developer to intervene or gets silently ignored because there's no admin control for it.

**Why it happens:**
"Store hours" as a milestone item reads as "a weekly schedule," and it's easy to ship only that and consider the operational gap (documented in `.context/INVESTIGACION-PEDIDOS-ONLINE.md` section 2.1) fully closed.

**How to avoid:**
Model it as two independent gates that both must pass for ordering to be allowed: the weekly schedule (`horario` table, per-day open/close in America/Lima), and a manual override flag (`pausado_manualmente` or similar) editable from `/admin` with one tap, defaulting to `false`. The storefront's "closed" messaging can distinguish "cerrado, abrimos a las 11:00" from "no estamos recibiendo pedidos en este momento" using the two independent signals.

**Warning signs:**
A schema with only `dia`/`hora_apertura`/`hora_cierre` columns and no manual toggle; an admin panel with no way to close ordering outside of editing the weekly schedule.

**Phase to address:**
Store business hours.

---

### Pitfall 11: In-memory rate limiting on `/api/charge` gives false confidence on Vercel

**What goes wrong:**
`/api/charge` runs as a Vercel serverless function. Each invocation may land on a different, stateless instance — an in-memory counter (`Map`, module-level variable) resets per cold start and is never shared across concurrent instances, so a naive "count requests per IP in a `Map`" limiter only limits requests that happen to hit the *same warm instance* in sequence. Under any real card-testing burst (which is often concurrent, multi-IP, or comes in fast enough to spin up multiple instances), the limiter does effectively nothing while looking, in code review, like it does.

**Why it happens:**
In-memory rate limiters are the fastest thing to write, work perfectly in local dev (single process) and in light manual testing, and the failure mode (limiter silently ineffective under real concurrent load) is invisible until an actual attack happens.

**How to avoid:**
Use a shared external store for the counter — Upstash Redis (has a genuinely free tier, fits the project's budget constraint) via `@upstash/ratelimit`, or Vercel KV. Rate-limit by IP as a baseline, but note that IP limiting alone is trivially bypassed by rotating IPs/proxies; pair it with the existing `MIN_CENTS`/`MAX_CENTS`/`MAX_QTY` bounds (`app/api/charge/route.ts:10-12`, already resolved) which limit blast radius per attempt even if request-rate limiting is imperfect. Rate limiting stops volume/scripting, not a determined single attacker with a few cards — that's an acceptable, explicit tradeoff for a free-tier small-business budget, not a gap to hide.

**Warning signs:**
A rate limiter implemented as a module-level `Map<string, number>` with no external store; load-testing the endpoint from two different processes/IPs simultaneously and seeing both succeed past the intended limit.

**Phase to address:**
Rate limiting on `POST /api/charge`.

---

### Pitfall 12: Kitchen Telegram notification fails silently

**What goes wrong:**
A Telegram bot notification is a fire-and-forget HTTP call from the order-creation path to `api.telegram.org`. If the bot token is revoked, the group chat ID changes (e.g. someone recreates the group), Telegram rate-limits the bot, or the call simply times out, the *order still gets created and charged successfully* — nothing in the current flow depends on the notification succeeding, which is correct for not blocking checkout, but means the failure is invisible unless explicitly surfaced. Given the milestone's stated no-monitoring-at-all baseline (CONCERNS.md item 8), a silently-broken kitchen notification could go unnoticed for days, defeating the entire point of the feature (kitchen finds out even without the tablet open) at exactly the moment it matters (a busy dinner rush with a stale tablet tab).

**Why it happens:**
Fire-and-forget is the correct choice for not blocking the customer's checkout on a Telegram outage, but that same correct choice removes the natural signal ("checkout broke") that would otherwise surface the problem.

**How to avoid:**
Wrap the Telegram call in a try/catch that logs failure distinctly (not swallowed silently), and route that log into whatever error-monitoring tool this milestone adds (Sentry or equivalent) with alerting — the same infrastructure needed for "alert when a charge succeeds but the Supabase insert fails" should also catch "Telegram notification failed." Store `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` as server-only env vars (never `NEXT_PUBLIC_*`) so a leaked token can only be found by someone with server access, not by inspecting the client bundle; if a token does leak, regenerating it via BotFather immediately invalidates the old one. Consider a low-cost heartbeat: a daily cron that sends a test "sistema OK" message to the same group, so a broken bot is caught by absence-of-heartbeat, not by a missed order going unnoticed.

**Warning signs:**
No try/catch around the Telegram fetch call; no alert path distinct from Vercel's raw function logs for notification failures; the bot token exposed to any client-side code path.

**Phase to address:**
Kitchen notification (Telegram); reinforced by the monitoring/alerting milestone item.

---

### Pitfall 13: Keep-warm cron pings the wrong thing

**What goes wrong:**
Supabase free-tier projects pause after a period of inactivity measured by actual database queries reaching the project — not by dashboard visits or by hitting a Vercel edge/serverless function that doesn't itself touch the DB. A "keep-warm" cron that only pings a Next.js route which returns `200` without ever querying Supabase does nothing to prevent the pause; the cron looks like it's working (200 OK every day) while the underlying project quietly pauses anyway. Separately, Vercel's Hobby plan restricts cron jobs to once-per-day scheduling (expressions like hourly fail at deploy time) and does not guarantee exact-minute timing — acceptable for a once-daily keep-warm ping given Supabase's pause window is measured in days, but worth being deliberate about rather than assumed.

**Why it happens:**
It's easy to build the cron endpoint as "hit a health-check route" without verifying that route actually performs a real Supabase query (e.g. a trivial `select` against `pedidos` or a dedicated `select 1`), especially since a health-check route that returns 200 *looks* like proof the system is fine.

**How to avoid:**
The keep-warm cron's target route must execute an actual Supabase query (e.g. `getSupabaseAdmin().from("pedidos").select("id").limit(1)`) and its own failure (Supabase down or paused) must itself alert — otherwise the cron becomes one more thing that "looks done" without verifying it does the one thing it exists for. Confirm the Vercel cron config uses a valid once-daily expression (fails loudly at deploy time on Hobby if not, which is at least a safe failure mode).

**Warning signs:**
A `/api/cron/keep-warm` (or similar) route with no import of `getSupabaseAdmin()`/Supabase client; a cron that has "always succeeded" in Vercel logs while the Supabase dashboard separately shows the project paused.

**Phase to address:**
Supabase free-tier auto-pause mitigation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Firing `purchase` only client-side, accepting the webhook-only order gap won't get an analytics event | Avoids double-counting risk entirely, ships faster | A handful of "browser died" orders per month undercount true revenue in GA4/Meta | Acceptable indefinitely at this scale (single small restaurant); revisit only if webhook-only orders become a meaningful % of volume |
| IP-only rate limiting on `/api/charge` without CAPTCHA/session nonce | Cheap, fast to ship, stops naive scripted abuse | Doesn't stop a determined attacker rotating IPs | Acceptable for a small restaurant not yet a carding target; escalate to Culqi's own fraud tools or add a nonce if abuse is observed |
| Reusing `codigo` as the public `/pedido/[codigo]` key without a separate unguessable token | Zero schema change, ships in one file | Direct customer-PII leak risk (Pitfall 5) — never acceptable | Never acceptable once the page is public |
| Keeping delivery-zone validation client-only while adding a server-side fee | Faster to ship the fee alone | Reopens a class of client-trusted-input bug on a different field (Pitfall 6) | Never acceptable — do both together |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Culqi webhooks | Trusting the POST body's amount/status without re-verifying | `GET /v2/charges/{id}` (or orders equivalent) server-side with `CULQI_SECRET_KEY` before writing to `pedidos` |
| Culqi Yape | Assuming Checkout Custom's `paymentMethods.yape: true` uses the QR/órdenes-de-pago flow | Verify against a real test payment which object (`culqi.token` vs `culqi.order`) actually fires in `lib/culqi.ts:190` |
| GA4 + Meta Pixel | Firing `purchase` both client-side and from the webhook | Pick one source of truth; if both are ever needed, share a stable `event_id`/`transaction_id` for dedup |
| Telegram Bot API | Fire-and-forget with no failure visibility | Try/catch + route failures into the same alerting used for payment errors; consider a daily heartbeat message |
| Vercel cron (Hobby plan) | Assuming sub-daily scheduling works, or that a 200 from the cron route proves the DB was touched | Once-daily max on Hobby; cron target must perform a real Supabase query, not just return 200 |
| Resend | Assuming email delivery is instant/guaranteed for order-status change notifications | Treat email send as best-effort, non-blocking for the status update itself; log failures |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Menu table queried fresh (no cache) on every storefront page load | Elevated Supabase read count against free-tier limits | `revalidate` + tag-based cache for the public menu read path (already the plan); charge path stays uncached/direct since it's once-per-checkout, not once-per-pageview | Meaningful traffic growth before Supabase Pro is adopted |
| Admin panel polling `/api/admin/pedidos` every 10s (`app/admin/page.tsx:319-323`) plus a new sound/badge mechanism layered on top without reusing the same poll | Redundant reads, or two out-of-sync polling loops | Drive the sound/badge off the same existing poll result, don't add a second interval | Not urgent at current scale, but easy to avoid now |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public `/pedido/[codigo]` keyed on a timestamp-derived, guessable code | Cross-customer PII leak (name, phone, address, order contents) — Ley 29733 exposure | Separate unguessable public token (Pitfall 5) |
| Telegram bot token in a `NEXT_PUBLIC_*` env var or otherwise reaching the client bundle | Anyone can spam the kitchen group or exfiltrate the token to impersonate the bot | Server-only env var; verify it's never referenced from client components |
| Webhook endpoint accidentally caught by a future, broadened Basic Auth matcher | Culqi can't authenticate as a browser user — webhook silently fails forever (401/503) | Keep `proxy.ts`'s `matcher` scoped exactly to `/admin/:path*` and `/api/admin/:path*` (already true); if it's ever broadened to `/api/:path*`, explicitly exclude `/api/culqi/webhook` |
| Rate limiter that only limits per-IP request count | Doesn't stop distributed/rotated-IP card testing | Combine with existing amount bounds; treat as a blast-radius reducer, not a complete fraud solution |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Storefront shows "closed" with no explanation of when it reopens | Customer leaves without knowing when to come back | Show next opening time computed in America/Lima from the schedule table |
| Sold-out item removable from cart only after checkout fails | Customer fills the whole form, pays, then gets rejected | Block add-to-cart client-side AND re-validate server-side in `/api/charge` (mirrors the existing `getMenuItem()` pattern) |
| Order-status page with no distinction between "no encontramos ese pedido" and "cerrado por seguridad" | Confuses legitimate customers who mistype a link with anyone probing for valid codes | Same generic "no encontrado" message for both cases, to avoid leaking which codes exist |

## "Looks Done But Isn't" Checklist

- [ ] **Culqi webhook:** Often missing re-verification against Culqi's API — verify the handler calls `GET /v2/charges/{id}` (or orders equivalent) rather than trusting the POST body.
- [ ] **Store hours:** Often missing explicit timezone handling — verify all time comparisons convert to `America/Lima`, never raw `new Date()` on the server.
- [ ] **Delivery fee:** Often missing the underlying zone check moving server-side too — verify `app/api/charge/route.ts` calls `sedeMasCercana`/`distanciaKm` from `lib/sedes.ts`, not just adds a fee number.
- [ ] **Menu cache invalidation:** Often missing a guarantee that `/api/charge`'s price lookup is decoupled from the storefront's cached menu fetch — verify they don't share a cache tag/key.
- [ ] **GA4/Meta purchase event:** Often fired from two places — verify there is exactly one firing point (client-side on confirmation, per Pitfall 8) or a shared `event_id` if both exist.
- [ ] **Public order-status link:** Often keyed directly on an existing, non-random order code — verify a separate unguessable token gates the page.
- [ ] **Rate limiting:** Often implemented as an in-memory counter — verify it uses an external store (Upstash Redis/Vercel KV) that survives across serverless instances.
- [ ] **Kitchen Telegram notification:** Often has no failure alerting — verify a failed Telegram call surfaces somewhere a human will see, not just Vercel logs.
- [ ] **Supabase keep-warm cron:** Often pings a route that doesn't touch the database — verify the cron target performs a real Supabase query.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Duplicate GA4/Meta purchase events already live in production | LOW | Remove one firing point; historical inflated data can be annotated/excluded in GA4 but not retroactively fixed — document the affected date range for whoever reviews ad performance |
| Guessable `/pedido/[codigo]` already shared with customers | MEDIUM | Rotate to a new token scheme; invalidate old links (they were never meant to be permanent secrets, so this is a one-time customer-support cost, not a data breach requiring notification if no evidence of actual scraping exists — but check Supabase logs for anomalous sequential access patterns first) |
| Stale-price mismatch already charged a customer the wrong (higher) amount | MEDIUM | Refund the difference via Culqi's dashboard/API, fix the cache-invalidation gap, and treat as a one-off — this is exactly the kind of dispute that damages trust for a single-owner brand, so prioritize fast manual resolution over root-cause perfection initially |
| Webhook duplicated an order already created by `/api/charge` | LOW | The existing `23505`-catch pattern should have prevented this at the DB layer; if it didn't (bug in the webhook's upsert logic), manually merge/delete the duplicate row in Supabase and fix the upsert code |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| 1. Wrong Yape flow assumed | Culqi webhook | One real Yape test payment inspected before the handler is written; confirmed ID prefix (`chr_` vs `ord_`) |
| 2. Trusting webhook payload | Culqi webhook | Handler contains an outbound `GET` call to Culqi's API before any Supabase write |
| 3. Webhook/charge race duplicating orders | Culqi webhook | Webhook route reuses the `23505`-catch upsert pattern from `app/api/charge/route.ts:134-148` |
| 4. Assumed retry schedule | Culqi webhook | No hardcoded retry-timing logic; reconciliation done via daily poll, not timeout math |
| 5. Guessable order-status codes | Public order-status link | `/pedido/[codigo]` route resolves via a separate random token column, not `codigo` alone |
| 6. Delivery zone check stays client-only | Delivery fee + minimum | `lib/sedes.ts` functions called from `app/api/charge/route.ts`, not just the map component |
| 7. Menu cache/charge price race | Menu → Supabase + cache | Charge route's price lookup verified to bypass the storefront's cache tag |
| 8. Duplicate purchase events | GA4 + Meta Pixel | Single firing point decided and documented before either client or webhook code is written |
| 9. Server-local time instead of America/Lima | Store business hours | All open/closed checks reviewed for explicit `timeZone: "America/Lima"` handling |
| 10. Closed vs. paused conflated | Store business hours | Admin panel has both a weekly schedule editor and an independent manual pause toggle |
| 11. In-memory rate limiter | Rate limiting on `/api/charge` | Load test from two concurrent processes/IPs confirms the limit holds across instances |
| 12. Silent Telegram failure | Kitchen notification | Failed notification attempts appear in the monitoring/alerting tool, not only Vercel logs |
| 13. Keep-warm cron pings the wrong thing | Supabase auto-pause mitigation | Cron target route confirmed to execute a real Supabase query, verified against Supabase's own activity dashboard |

---

## Peru-Specific Legal Notes (context, not new scope)

- **Ley N° 32495 (libro de reclamaciones):** already implemented and out of this research's scope per `.planning/codebase/CONCERNS.md` — but worth restating the stakes given it already caused one production 500 via Supabase auto-pause (item 4 in CONCERNS.md, item 13 above): the fine is ~1 UIT (~S/5,500 at 2026's UIT).
- **SUNAT boleta electrónica:** explicitly out of scope for this milestone per `.planning/PROJECT.md` (pending Jaime's accountant). For context to accelerate that decision: not issuing a required comprobante carries a fine of 50% UIT on first offense (~S/2,750 at 2026's UIT) rising toward 2 UIT (~S/11,000) on repeat offenses for businesses without a fixed commercial premises (which likely applies to pure delivery/online sales), per SUNAT's Código Tributario framework — voluntary correction before any SUNAT notification reduces the fine up to 95%. (MEDIUM confidence — multiple third-party tax-advisory sources agree on the figures; not independently verified against SUNAT's primary resolution text.)
- **Ley 29733 (protección de datos personales):** applies to any business processing personal data in Peru, size notwithstanding — obligations include registering "bancos de datos personales" with the national registry (formerly APDP, migrated under a newer authority per 2024 regulatory updates), obtaining informed consent, and implementing security measures. The `pedidos` table (name, phone, email, address) and the new public order-status feature both fall under this. This milestone does not need to solve full regulatory registration, but Pitfall 5 (guessable order codes) is the concrete, immediate security-measure failure this law would flag first. (MEDIUM confidence — the general obligation is well-documented across multiple sources; the practical enforcement posture toward a single-owner restaurant is not verified.)

---

## Sources

- [Webhooks — Culqi (docs.culqi.com)](https://docs.culqi.com/es/documentacion/pagos-online/webhooks/) — fetched directly; confirms webhook configuration via CulqiPanel but does not document payload structure, signature/authentication, or retry schedule (HIGH confidence on what's absent, since fetched directly).
- [Órdenes de Pago — Resumen (docs.culqi.com)](https://docs.culqi.com/es/documentacion/pagos-online/ordenes-de-pago/resumen/) — fetched directly; confirms webhooks are "obligatorio" for asynchronous order-based payments and references `order.status.changed`.
- [Órdenes de Pago — Billeteras Móviles (docs.culqi.com)](https://docs.culqi.com/es/documentacion/pagos-online/ordenes-de-pago/billetera-moviles/) — found via search; QR-based Yape flow via pre-created orders.
- [Cargos Únicos — Tokens Yape (docs.culqi.com)](https://docs.culqi.com/es/documentacion/pagos-online/cargo-unico/tokens-yape) — fetched directly; describes the approval-code token flow for Yape as a synchronous charge, S/2000 max.
- [Checkout Custom (docs.culqi.com)](https://docs.culqi.com/es/documentacion/checkout/checkout-custom) — fetched directly; states the `order` parameter is required for the Yape option to display in Checkout Custom.
- Repo source read directly: `lib/culqi.ts`, `app/api/charge/route.ts`, `proxy.ts`, `lib/menu.ts`, `lib/sedes.ts`, `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `.context/INVESTIGACION-PEDIDOS-ONLINE.md`, `.planning/codebase/STACK.md`.
- GA4/Meta Pixel event deduplication via shared `event_id`/`transaction_id` — general pattern confirmed across multiple current marketing-ops sources (Analyzify, Optizent, TAGGRS); MEDIUM confidence, not Meta/Google primary docs.
- Vercel Hobby plan cron limited to once-daily scheduling, imprecise timing — [Vercel Cron Jobs docs and third-party summaries](https://vercel.com/docs/cron-jobs/usage-and-pricing), MEDIUM confidence.
- Supabase free-tier project pause after ~7 days of no real database activity — multiple 2026 third-party sources agree; MEDIUM confidence (not fetched from Supabase's own current docs directly).
- In-memory rate limiting ineffective across stateless serverless instances; Upstash Redis as the standard fix — [Upstash blog](https://upstash.com/blog/edge-rate-limiting), [upstash/ratelimit-js](https://github.com/upstash/ratelimit-js), MEDIUM-HIGH confidence (well-established serverless pattern).
- SUNAT fine figures for not issuing comprobantes electrónicos — multiple third-party tax-advisory sites (Mifact, Intelectta) agree on ~50% UIT / 2 UIT figures for 2026; MEDIUM confidence, not verified against SUNAT's primary resolution text.
- Ley 29733 general obligations (registro de bancos de datos, consentimiento, medidas de seguridad) — [LP Derecho summary](https://lpderecho.pe/ley-proteccion-datos-personales-ley-29733-actualizada/), [kom.pe summary](https://kom.pe/ley-29733-proteccion-datos-personales/); MEDIUM confidence on general applicability, LOW confidence on specific enforcement posture toward a business this size.
- Culqi webhook retry-schedule figures (immediate/+1min/+10min/+30min/+1h) surfaced via search but **could not be confirmed as belonging to Culqi's own documentation** — explicitly flagged LOW confidence / unverified in Pitfall 4, not used as a design input.

---
*Pitfalls research for: Restaurant online ordering (Peru) — Lobo Burger milestone: webhook, hours, stock, kitchen notify, delivery fee, analytics, DB menu, order status, rate limiting, monitoring*
*Researched: 2026-08-24*
