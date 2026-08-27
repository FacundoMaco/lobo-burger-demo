---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 03
subsystem: infra
tags: [telegram, sentry, alertas, monitoreo, next-instrumentation, tdd]

requires:
  - phase: 01-integridad-del-pago-y-red-de-seguridad
    provides: "Runner de Vitest + mock de getSupabaseAdmin() + caracterizacion en verde de app/api/charge/route.ts (plan 01-01)"
provides:
  - "lib/alertas.ts — alertaTelegram(mensaje), canal humano best-effort reusable en Fase 3 (OPS-05)"
  - "instrumentacion de Sentry server+edge (instrumentation.ts, sentry.server.config.ts, sentry.edge.config.ts) para INFRA-03"
  - "app/api/charge/route.ts cableado: las dos ramas de fallo de persistencia disparan alertaTelegram + Sentry.captureException"
affects: [fase-3-ops, fase-1-plan-05, fase-1-plan-06, fase-1-plan-07]

tech-stack:
  added: ["@sentry/nextjs@^10.71.0"]
  patterns:
    - "Canal humano (Telegram) desacoplado del motor de captura de errores (Sentry) — dos responsabilidades distintas, un fallo de una no arrastra a la otra"
    - "Excepcion deliberada al patron de fallar cerrado del repo: alertaTelegram() nunca lanza, degrada a console.error"
    - "instrumentation.ts con import dinamico segun NEXT_RUNTIME para no cargar el SDK de Node en el bundle edge"

key-files:
  created:
    - lib/alertas.ts
    - __tests__/alertas.test.ts
    - __tests__/api-charge.alertas.test.ts
    - instrumentation.ts
    - sentry.server.config.ts
    - sentry.edge.config.ts
  modified:
    - app/api/charge/route.ts
    - .env.example
    - package.json
    - package-lock.json

key-decisions:
  - "alertaTelegram() usa await, no fire-and-forget, para que Vercel serverless no mate la promesa antes de que la alerta salga"
  - "Sentry.init con sendDefaultPii:false explicito (T-01-12): no se adjunta el body del request, solo cargo.id/codigo/totalCents"
  - "NO se crea instrumentation-client.ts ni se envuelve next.config.ts con withSentryConfig (D-01 corregida, Pitfall B) — el bundle del navegador y el build sin SENTRY_AUTH_TOKEN quedan intactos"

requirements-completed: [PAY-05, INFRA-03]

duration: ~15min (interrumpido por limite de cuota de sesion entre 4df3210 y 465ac38; sin perdida de trabajo, commits verificados al reanudar)
completed: 2026-08-26
---

# Phase 1 Plan 03: Canal de alertas (Telegram + Sentry) Summary

`lib/alertas.ts` con `alertaTelegram()` best-effort via fetch directo a la Bot API de Telegram, instrumentacion de Sentry server+edge de Next 16 sin `withSentryConfig`, y las dos ramas de `app/api/charge/route.ts` donde hoy un pedido cobrado se pierde en silencio ahora disparan ambas.

## Performance

- **Tasks:** 3/3 completadas
- **Files modified:** 10 (6 creados, 4 modificados)
- **Tests nuevos:** 10 (6 en `alertas.test.ts` + 4 en `api-charge.alertas.test.ts`)
- **Suite completa:** 38/38 en verde (28 preexistentes + 10 nuevos)

## Accomplishments

- Canal humano de alertas (`alertaTelegram`) probado en sus tres ramas: sin configuracion (degrada a `console.error`), configurada (un POST a la Bot API), y de fallo (nunca lanza).
- Instrumentacion de Sentry (server + edge) conectada via `instrumentation.ts`/`onRequestError`, cubriendo `/api/charge`, `/api/culqi/webhook` y `/api/reclamaciones` sin tocar ninguna de las tres rutas.
- `app/api/charge/route.ts` cableado en las dos ramas de fallo de persistencia (insert no-23505 y excepcion de `getSupabaseAdmin()`), con test explicito de que `23505` (idempotencia) NO dispara alerta.

## Task Commits

1. **Task 1 — lib/alertas.ts (RED → GREEN)**
   - `10f3218` — test(01-03): RED - alertaTelegram sin configuracion, configurada y fallo
   - `8250d64` — feat(01-03): lib/alertas.ts - canal humano de alertas via Telegram
2. **Task 2 — Instrumentacion de Sentry server+edge**
   - `badbf00` — feat(01-03): instrumentacion de Sentry server + edge (INFRA-03)
3. **Task 3 — Cablear la alerta en app/api/charge/route.ts (RED → GREEN)**
   - `4df3210` — test(01-03): RED - alertaTelegram cableada en las dos ramas de fallo de insert
   - `465ac38` — feat(01-03): cablear alertaTelegram + Sentry en las dos ramas de fallo de insert

## Gates RED (obligatorio registrar)

**Task 1** — `npx vitest run __tests__/alertas.test.ts` antes de crear `lib/alertas.ts`:
```
Error: Cannot find package '@/lib/alertas' imported from .../__tests__/alertas.test.ts
```
Fallo por modulo inexistente, no por sintaxis del test. RED valido.

**Task 3** — `npx vitest run __tests__/api-charge.alertas.test.ts` contra el handler sin cablear:
```
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
  expect(alertaTelegram).toHaveBeenCalledTimes(1);
```
2 de 4 tests fallaron porque `alertaTelegram` no fue llamada (los 2 restantes — 23505 y camino feliz — ya pasaban porque no esperan la llamada). RED valido.

## Files Created/Modified

- `lib/alertas.ts` — `alertaTelegram(mensaje)`, fetch directo a `api.telegram.org`, sin SDK
- `__tests__/alertas.test.ts` — 6 tests: sin config (token vacio, chat_id vacio, ambos vacios), configurada, fetch rechaza, fetch `ok:false`
- `instrumentation.ts` — `register()` ramificado por `NEXT_RUNTIME`, `onRequestError` reenvia a `Sentry.captureRequestError`
- `sentry.server.config.ts` / `sentry.edge.config.ts` — `Sentry.init` gateado por `SENTRY_DSN`, `tracesSampleRate: 0`, `sendDefaultPii: false`
- `app/api/charge/route.ts` — import de `Sentry` y `alertaTelegram`; 2 bloques agregados (insert no-23505, catch de excepcion), 0 lineas eliminadas
- `__tests__/api-charge.alertas.test.ts` — 4 tests: fallo insert dispara alerta con contenido verificado, excepcion dispara alerta, 23505 NO dispara, camino feliz NO dispara
- `.env.example` — documenta `SENTRY_DSN`, `TELEGRAM_ALERT_BOT_TOKEN`, `TELEGRAM_ALERT_CHAT_ID`
- `package.json` / `package-lock.json` — `@sentry/nextjs@^10.71.0`

## Decisions Made

- `alertaTelegram()` usa `await` (no fire-and-forget) en las dos ramas de `app/api/charge/route.ts`: en Vercel serverless una promesa sin `await` puede no completarse antes de que la funcion termine, justo en el caso donde la alerta es mas critica.
- Mensaje de alerta incluye los 5 datos obligatorios (cobro confirmado, `cargo.id`, `codigo`, total en soles, nombre+telefono del cliente), verificado en el test con asserts sobre el contenido, no solo sobre la llamada.
- `Sentry.captureException` recibe `{ extra: { cargoId, codigo, totalCents } }`, nunca el body completo del request (T-01-12).
- `sendDefaultPii: false` explicito en ambos `sentry.*.config.ts`, aunque sea el default del SDK — documentado en el codigo como mitigacion deliberada del threat register.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug en mi propio test] Asserts sobre `console.error` con `toHaveBeenCalledWith` de un solo string**
- **Found during:** Task 1, primera corrida de `alertas.test.ts` tras implementar `lib/alertas.ts`
- **Issue:** el test original esperaba `errorSpy.toHaveBeenCalledWith(expect.stringContaining(...))` pero la implementacion (siguiendo el mismo patron multi-argumento que ya usa `app/api/charge/route.ts` con `console.error("Pedido cobrado pero no registrado:", cargo.id, error)`) llama a `console.error` con 2-3 argumentos, no uno solo.
- **Fix:** los asserts se cambiaron a `expect(errorSpy).toHaveBeenCalled()` + `expect(errorSpy.mock.calls[0].join(" ")).toContain(...)`, consistente con el estilo multi-argumento del repo. No se cambio la implementacion.
- **Files modified:** `__tests__/alertas.test.ts`
- **Commit:** `8250d64` (mismo commit del GREEN, el test aun no se habia commiteado en verde)

### Discrepancia de bajo impacto en acceptance criteria

**2. `grep -c 'alertaTelegram' app/api/charge/route.ts` devuelve 3, no 2**
- El criterio de aceptacion de la Task 3 esperaba 2. El resultado real es 3 porque `grep -c` cuenta lineas que matchean, y la linea de `import { alertaTelegram } from "@/lib/alertas";` tambien matchea, ademas de las 2 llamadas reales. No es posible llamar la funcion sin importarla por su nombre. No se considera un bug: las 2 llamadas reales existen, verificadas con los 4 tests de `api-charge.alertas.test.ts`.

---

**Total deviations:** 1 auto-fix (test propio), 1 discrepancia de conteo documentada, sin impacto en funcionalidad.
**Impact on plan:** Ninguno sobre el comportamiento entregado. Ambos items son de calidad de test/verificacion, no de codigo de produccion.

## Issues Encountered

- La ejecucion se corto por limite de cuota de sesion entre el commit `4df3210` (RED de Task 3) y la implementacion GREEN. Al reanudar se reconfirmo el estado real con `git log` y `npm run test:run` en vez de asumir el contexto previo — sin perdida de trabajo ni commits duplicados.
- `node_modules` no estaba instalado al arrancar el worktree; se instalo con `npm install --legacy-peer-deps` (mismo patron que 01-01 por el conflicto de peers de babel entre `shadcn` y `@vitejs/plugin-react`), sin necesidad de checkpoint porque no se instalo ningun paquete nuevo en ese paso (solo se restauro el lockfile existente).

## Estado de credenciales externas (D-03b)

- **Telegram** (`TELEGRAM_ALERT_BOT_TOKEN`, `TELEGRAM_ALERT_CHAT_ID`): **pendientes de Jaime**. No hay `.env.local` en el worktree con estas variables. `alertaTelegram()` degrada a `console.error` hasta que se entreguen — comportamiento probado y documentado, no bloquea el resto de la fase.
- **Sentry** (`SENTRY_DSN`): **pendiente** (ninguna cuenta creada). `npm run build` confirmado en verde sin la variable.
- **PAY-05 queda verificado a nivel de codigo** (los 4 tests de `api-charge.alertas.test.ts` prueban que la alerta se dispara con el contenido correcto y que el handler sigue devolviendo 200). La verificacion de que el mensaje efectivamente llega a un celular es manual y queda pendiente para el plan 01-08, una vez que Jaime entregue el bot/grupo de Telegram y, opcionalmente, se cree la cuenta de Sentry.

## Known Stubs

Ninguno. No se crearon componentes de UI ni datos mockeados que lleguen a produccion.

## Threat Flags

Ninguno nuevo fuera del threat register del plan. Los 6 threats (T-01-10 a T-01-15) y T-01-SC ya estaban identificados en `01-03-PLAN.md` y sus mitigaciones se implementaron segun lo especificado:
- T-01-10 (token en el bundle): `grep -c NEXT_PUBLIC lib/alertas.ts` = 0; `grep -rl api.telegram.org .next/static` = 0 archivos.
- T-01-12 (PII a Sentry): `sendDefaultPii: false` explicito, solo `cargoId`/`codigo`/`totalCents` en `extra`.
- T-01-13 (alerta rota tumba el cobro): 2 tests de fallo de `fetch` (rechaza / `ok:false`), handler sigue devolviendo 200 en ambas ramas de la Task 3.
- T-01-14 (falsos positivos por 23505): test explicito de que `23505` no dispara alerta.
- T-01-15 (build roto pidiendo `SENTRY_AUTH_TOKEN`): sin `withSentryConfig`; `git diff --exit-code -- next.config.ts` = 0; build confirmado sin `SENTRY_DSN`.

## Verification

- `npm run test:run`: 38/38 en verde (28 preexistentes de 01-01 + 6 de `alertas.test.ts` + 4 de `api-charge.alertas.test.ts`)
- `npx tsc --noEmit`: sin errores
- `npm run lint`: sin errores nuevos (3 preexistentes de 01-01, documentados como fuera de scope, en `app/puntos/page.tsx` y `lib/cart-context.tsx` — archivos no tocados por este plan)
- `npm run build` sin `SENTRY_DSN`: compila sin errores
- `git diff --exit-code -- __tests__/api-charge.caracterizacion.test.ts`: exit 0, caracterizacion de 01-01 intacta
- `git diff --stat -- app/api/charge/route.ts`: 18 inserciones, 0 eliminaciones
- `test ! -f instrumentation-client.ts`: confirmado
- `grep -rl 'api.telegram.org' .next/static`: 0 archivos

## User Setup Required

Ver `user_setup` en el frontmatter de `01-03-PLAN.md`: Jaime debe crear el bot de Telegram (`@BotFather` → `/newbot`) y un grupo de alertas tecnicas para `TELEGRAM_ALERT_BOT_TOKEN`/`TELEGRAM_ALERT_CHAT_ID`, y opcionalmente una cuenta gratuita de Sentry para `SENTRY_DSN`. Ninguna de las dos bloquea el resto de la fase (D-03b): el sistema funciona igual sin ellas, degradando a `console.error`.

## Next Phase Readiness

- Los planes 01-05/01-06/01-07 quedan habilitados para reusar `alertaTelegram()` en el rate limiter, webhook y cron de reconciliacion (mismo canal, misma degradacion sin credenciales).
- La Fase 3 (OPS-05, aviso a cocina) reusa `lib/alertas.ts` sin cambios de codigo, solo un `chat_id` distinto sobre el mismo bot.
- Bloqueante real pendiente: verificacion humana de que el mensaje llega a un celular real — se hace en el plan 01-08, una vez Jaime entregue las credenciales.

---
*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Completed: 2026-08-26*
