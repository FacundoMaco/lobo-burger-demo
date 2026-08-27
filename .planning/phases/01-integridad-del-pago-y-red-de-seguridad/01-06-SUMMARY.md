---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 06
subsystem: payments
tags: [rate-limiting, postgres, atomic-upsert, vitest, tdd, next16]

requires:
  - phase: 01-integridad-del-pago-y-red-de-seguridad
    provides: "01-01 caracterizacion de /api/charge + supabase-mock.ts reusable; 01-03 alertaTelegram(); 01-05 orden de validaciones tempranas"

provides:
  - "supabase/migrations/20260825000000_rate_limit.sql — tabla rate_limit_charge + funcion atomica increment_rate_limit, NO aplicada a produccion todavia"
  - "lib/rate-limit.ts — calcularWindowStart/debeBloquear puras, contarIntento() fail-open"
  - "POST /api/charge rechaza 429 por exceso de intentos por IP, antes de tocar Culqi"

affects: [webhook-culqi-01-02, cron-reconciliacion-01-07, plan-01-08-verificacion-humana]

tech-stack:
  added: []
  patterns:
    - "Rate limiter con contador atomico en Postgres (on conflict do update ... returning), no en memoria, para sobrevivir instancias serverless distintas"
    - "Matematica pura (calcularWindowStart, debeBloquear) separada de la parte de red (contarIntento) para maximizar cobertura sin mocks de concurrencia"
    - "Fail-open con alerta ante caida de Supabase, coherente con la postura ya existente del handler (insert de pedidos no-fatal)"

key-files:
  created:
    - supabase/migrations/20260825000000_rate_limit.sql
    - lib/rate-limit.ts
    - __tests__/rate-limit.test.ts
    - __tests__/api-charge.rate-limit.test.ts
  modified:
    - app/api/charge/route.ts
    - __tests__/helpers/supabase-mock.ts
    - __tests__/api-charge.caracterizacion.test.ts
    - __tests__/api-charge.alertas.test.ts

key-decisions:
  - "Fail-open (decision humana, Task 1): si Supabase no responde al contar, el cobro sigue adelante y se dispara alertaTelegram avisando que el rate limiter quedo ciego. Razonamiento completo abajo en 'Decision Task 1'."
  - "LIMITE_INTENTOS=10 por hora por IP (VENTANA_MS=1h, fija no deslizante), constante SCREAMING_SNAKE_CASE con comentario que justifica el valor: un local hace decenas de pedidos/dia, no miles, y dos-tres reintentos honestos de tarjeta rechazada caben debajo del limite."
  - "En el limite exacto (intentos===limite) el request NO se bloquea: debeBloquear(intentos, limite) = intentos > limite. El limite es la cantidad de intentos permitidos, no el primero que se rechaza."
  - "Dos tests preexistentes (01-01 caracterizacion, 01-03 alertas) se editaron porque su aserción quedó invalidada por el diseño explícito del plan (rate limit antes de todo, incluido antes del fetch a Culqi) — ver Deviations."

requirements-completed: [PAY-06]

duration: ~35min
completed: 2026-08-26
---

# Phase 1 Plan 06: Rate limiting por IP en /api/charge Summary

Migracion con tabla + funcion atomica de Postgres, `lib/rate-limit.ts` con la matematica de ventana pura y `contarIntento()` fail-open, y el cableado en `POST /api/charge` que rechaza con 429 antes de tocar Culqi. **La migracion NO fue aplicada a produccion** — queda como Task 5, checkpoint humano bloqueante que este ejecutor no puede resolver (requiere acceso a la base real de Supabase de Jaime y dos procesos concurrentes de verdad).

## Decision Task 1 (checkpoint humano, resuelto antes de esta ejecucion)

**Elegido: fail-open con alerta.**

Cuando `contarIntento()` no puede contar (error o excepcion de Supabase), `/api/charge` deja pasar el cobro y dispara `alertaTelegram()` avisando que el rate limiter quedo ciego. Razonamiento (registrado tambien como comentario en `lib/rate-limit.ts`):

1. **Coherencia con el handler**: el insert en `pedidos` tras un cobro exitoso YA es no-fatal (`app/api/charge/route.ts`). El sistema ya decidio que una caida de Supabase no tumba una venta; fail-closed en el rate limiter contradiria esa postura en el mismo archivo.
2. **Defensa en profundidad, no la unica barrera**: Culqi tiene sus propios controles antifraude. Perder ventas un viernes 20:00 es dano cierto; quedar ciego al card testing un rato es riesgo acotado, y con alerta.
3. **Riesgo aceptado explicitamente**: si alguien descubre que puede cegar el rate limiter esperando a que Supabase se autopause (free tier), fail-open es la ventana que busca. El cron keep-alive del plan 01-08 la achica, no la elimina. Queda anotado como riesgo conocido, no como accidente de implementacion.

## Task Commits

1. **Task 2 — Migracion** — `c60ea92` (feat)
2. **Task 3 — RED** — `c7a29bc` (test)
3. **Task 3 — GREEN** — `f71b3e8` (feat)
4. **Task 4 — RED** — `2f3fa4c` (test)
5. **Task 4 — GREEN + ajuste de tests preexistentes** — `66e6cd3` (feat)

Gate TDD (D-23) confirmado dos veces: `test → feat` (Task 3) y `test → feat` (Task 4), sin commits de refactor (el plan no pedia ninguno).

## Gates RED (obligatorio registrar)

**Task 3** — `npx vitest run __tests__/rate-limit.test.ts` antes de crear `lib/rate-limit.ts`:
```
Error: Failed to resolve import "@/lib/rate-limit" from "__tests__/rate-limit.test.ts". Does the file exist?
```
Fallo por resolucion de modulo, no por sintaxis del test. RED valido.

**Task 4** — `npx vitest run __tests__/api-charge.rate-limit.test.ts` contra el handler sin cablear:
```
5 failed | 1 passed (6)
```
5 de 6 asserts fallaron (429 nunca llega, `fetch` a Culqi se llama igual, `mock.calls.rpcArgs[0]` es `undefined` porque nunca se llama al RPC). El unico que pasaba de entrada ("con el contador por debajo del limite, el request procede normalmente") pasaba porque ese es el camino que YA funcionaba sin rate limiter. RED valido.

## Files Created/Modified

- `supabase/migrations/20260825000000_rate_limit.sql` — tabla `rate_limit_charge` (PK compuesta `ip, window_start`) + funcion `increment_rate_limit` (limpieza oportunista + upsert atomico en una sola llamada). **NO aplicada a produccion.**
- `lib/rate-limit.ts` — `calcularWindowStart(now, windowMs)`, `debeBloquear(intentos, limite)` puras; `contarIntento(ip, windowMs)` impura, fail-open documentado; `LIMITE_INTENTOS=10`, `VENTANA_MS=1h`.
- `__tests__/rate-limit.test.ts` — 9 casos: matematica de ventana (misma ventana, borde superior, multiplo exacto de epoch), umbral de bloqueo (debajo/exacto/encima), contarIntento (numero real del RPC, fail-open por error, fail-open por excepcion).
- `__tests__/api-charge.rate-limit.test.ts` — 6 casos: camino feliz bajo el limite, 429 sobre el limite, `fetch` a Culqi nunca se llama en 429, IPs distintas contadas por separado (assert sobre `p_ip`), `x-forwarded-for` con lista usa la primera IP, mensaje 429 sin numeros.
- `app/api/charge/route.ts` — import de `lib/rate-limit`; bloque de rate limit inmediatamente despues de parsear el body, antes del chequeo de tipos/validarEmail/recalculo de precio/fetch a Culqi. IP tomada de `x-forwarded-for` (primer valor si viene lista).
- `__tests__/helpers/supabase-mock.ts` — agregado soporte para `.rpc(fn, params)`, con default `{data:1, error:null}` cuando el test no configura `rpcResults` (para no afectar suites que no les importa el rate limit).
- `__tests__/api-charge.caracterizacion.test.ts` / `__tests__/api-charge.alertas.test.ts` — 2 aserciones ajustadas, ver Deviations.

## Verification

- `npm run test:run`: **82/82 en verde** (67 preexistentes + 9 de `rate-limit.test.ts` + 6 de `api-charge.rate-limit.test.ts`, con 2 aserciones editadas en suites preexistentes)
- `npx tsc --noEmit`: sin errores
- `npm run lint`: sin errores nuevos (3 preexistentes en `app/puntos/page.tsx` y `lib/cart-context.tsx`, archivos no tocados por este plan, ya documentados en 01-03)
- `npm run build`: compila y genera todas las rutas correctamente, incluida `/api/charge` como dinamica
- `grep -n "rate-limit|validarEmail" app/api/charge/route.ts`: el import de `@/lib/rate-limit` (linea 12) y las llamadas a `contarIntento`/`debeBloquear` (lineas 61-62) preceden a `validarEmail(email)` (linea 87)
- `grep -c "Date.now()"` en `lib/rate-limit.ts`: 2 matches, ambos fuera del cuerpo de `calcularWindowStart` (un comentario y la unica llamada real dentro de `contarIntento`)
- Mensaje del 429 (`"Demasiados intentos. Espera unos minutos antes de volver a intentar."`) sin ningun digito, verificado con regex `[0-9]`

## Deviations from Plan

### Auto-fixed Issues (Rule 1 — asercion invalidada por diseno intencional del propio plan)

**1. `api-charge.caracterizacion.test.ts` — "responde 402 ... y no llama a Supabase"**
- **Found during:** Task 4, primera corrida de `npm run test:run` tras cablear el rate limit.
- **Conflicto:** el plan exige simultaneamente (a) que el rate limit vaya "ANTES de todo lo demas", incluido antes del fetch a Culqi, y (b) que la suite de caracterizacion (01-01) pase "sin haber sido editada". Ambas cosas no pueden ser ciertas a la vez: si `contarIntento()` llama a `getSupabaseAdmin().rpc(...)` en TODO request (incluido el que Culqi termina rechazando), la asercion original `expect(getSupabaseAdmin).not.toHaveBeenCalled()` queda falsa por diseno, no por un bug.
- **Fix:** se cambio la asercion para verificar el invariante real que protegia el test (que un cargo rechazado nunca persiste una fila en `pedidos`), usando `mock.calls.table`/`insertArgs` en vez del contador de llamadas a `getSupabaseAdmin`. La logica de produccion no cambio para acomodar el test.
- **Files modified:** `__tests__/api-charge.caracterizacion.test.ts`
- **Commit:** `66e6cd3`

**2. `api-charge.alertas.test.ts` — "excepcion de getSupabaseAdmin() dispara alertaTelegram una vez"**
- **Found during:** Task 4, misma corrida.
- **Issue:** ese test simula `getSupabaseAdmin()` lanzando una excepcion en CADA llamada. Con el rate limiter tambien llamando a `getSupabaseAdmin()` (antes de la persistencia), ahora hay DOS fallos independientes en el mismo request cuando Supabase esta totalmente caido: el rate limiter (fail-open) y la persistencia del pedido. Cada uno dispara su propia alerta — son dos hechos reales, no un doble-conteo del mismo evento.
- **Fix:** el test ahora espera `toHaveBeenCalledTimes(2)` y verifica que uno de los dos mensajes contenga el `cargo.id` (el de persistencia), documentando explicitamente por que el numero cambio.
- **Files modified:** `__tests__/api-charge.alertas.test.ts`
- **Commit:** `66e6cd3`

### Sin impacto en produccion

Ninguno de los dos ajustes toco `app/api/charge/route.ts` mas alla del cableado ya descrito, ni cambio el comportamiento observable del handler para un cliente real — unicamente corrigieron el alcance de dos aserciones de test que asumian una invariante que el propio plan 01-06 invalida a proposito.

---

**Total deviations:** 2 (ambas Rule 1, ediciones documentadas de tests preexistentes por conflicto explicito entre dos criterios del propio plan). **Impact on plan:** ninguno sobre PAY-06; ambas quedan resueltas preservando el invariante real que cada test protegia.

## Issues Encountered

- `node_modules` no existia en el worktree al arrancar (mismo patron que 01-01/01-03/01-05); se instalo con `npm install --legacy-peer-deps`.

## Task 5 — PENDIENTE (checkpoint humano bloqueante)

**No ejecutado por este agente.** Requiere:
1. Aplicar `supabase/migrations/20260825000000_rate_limit.sql` al proyecto de Supabase de produccion (SQL Editor del dashboard o `supabase db push`).
2. Confirmar en el dashboard que `rate_limit_charge` e `increment_rate_limit` existen.
3. Verificar atomicidad real: dos llamadas CONCURRENTES al RPC con el mismo `p_ip`/`p_window_start` desde dos procesos distintos deben devolver 1 y 2, nunca 1 y 1.
4. Verificar limpieza oportunista: insertar una fila con `window_start` de mas de 1 hora, llamar al RPC, confirmar que la fila vieja desaparecio.
5. **Orden obligatorio: migracion antes que el codigo.** Los commits de las Tasks 2-4 (`c60ea92`, `c7a29bc`, `f71b3e8`, `2f3fa4c`, `66e6cd3`) llaman a un RPC que hoy NO existe en produccion. **No se hizo push a ninguna rama de despliegue** — quedan solo en este worktree/rama local, tal como exige el acceptance criteria de la Task 4, hasta que la migracion este aplicada.
6. Con el codigo ya en produccion, hacer un pedido real de prueba y confirmar que el checkout sigue funcionando.

Este plan queda **incompleto** hasta que un humano con acceso al proyecto de Supabase de produccion resuelva la Task 5 y registre los numeros exactos de la verificacion de concurrencia.

## User Setup Required

Ver `user_setup` en el frontmatter de `01-06-PLAN.md`: Jaime (o quien tenga acceso al dashboard de Supabase) debe aplicar la migracion `20260825000000_rate_limit.sql` — es la parte de la Task 5 que este agente no puede ejecutar.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno nuevo fuera del threat register de `01-06-PLAN.md`. Los 7 threats (T-01-26 a T-01-32) ya estaban identificados en el plan; T-01-28 (contador en memoria que no protege) y T-01-32 (desplegar codigo antes que la migracion) quedan sin cerrar del todo hasta que la Task 5 se ejecute — es exactamente lo que documenta esta seccion.

## Next Phase Readiness

- PAY-06 cerrado a nivel de codigo. Bloqueante real: aplicar la migracion y verificar concurrencia en produccion (Task 5), fuera del alcance de este agente.
- El plan 01-07 (cron de reconciliacion) y el plan 01-08 (verificacion humana de Telegram/Sentry) pueden avanzar en paralelo sin depender de que la Task 5 este resuelta, siempre que sus propios cambios no dependan del RPC `increment_rate_limit`.
- Riesgo residual documentado en el threat register (T-01-27, spoofing de `x-forwarded-for`): aceptado explicitamente, no mitigado en este plan.

---
*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Completed (parcial, Task 5 pendiente): 2026-08-26*

## Self-Check: PASSED

Archivos verificados en disco:
- FOUND: `supabase/migrations/20260825000000_rate_limit.sql`
- FOUND: `lib/rate-limit.ts`
- FOUND: `__tests__/rate-limit.test.ts`
- FOUND: `__tests__/api-charge.rate-limit.test.ts`
- FOUND: `.planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-06-SUMMARY.md`

Commits verificados en `git log --oneline`:
- FOUND: `c60ea92` (feat — migracion)
- FOUND: `c7a29bc` (test — RED lib/rate-limit.ts)
- FOUND: `f71b3e8` (feat — GREEN lib/rate-limit.ts)
- FOUND: `2f3fa4c` (test — RED cableado en /api/charge)
- FOUND: `66e6cd3` (feat — GREEN cableado + ajustes de tests preexistentes)
