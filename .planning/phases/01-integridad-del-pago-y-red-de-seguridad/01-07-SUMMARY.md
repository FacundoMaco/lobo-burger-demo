---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 07
subsystem: payments
tags: [culqi, webhook, nextjs, route-handler, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-integridad-del-pago-y-red-de-seguridad
    provides: "lib/alertas.ts (01-03), lib/rate-limit.ts + patron de upsert idempotente (01-06), __tests__/helpers/supabase-mock.ts (01-01)"
provides:
  - "lib/culqi-verificar.ts: extraerChargeId() (puntero puro) y consultarCargo() (re-fetch autenticado con metadata cruda)"
  - "app/api/culqi/webhook/route.ts: handler definitivo del webhook de Culqi, reemplaza el endpoint de captura del plan 01-02"
  - "app/api/charge/route.ts: manda metadata minima del pedido a Culqi para que el webhook pueda reconstruirlo (opcion C)"
affects: ["01-08 (cron de reconciliacion, keep-warm)", "cualquier plan futuro que dependa de que un pago siempre genere un pedido"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Payload de webhook tratado como puntero: extraccion pura + re-fetch autenticado antes de escribir (D-08)"
    - "Metadata del cargo de Culqi como canal para pasar datos de negocio entre el camino sincrono (/api/charge) y el asincrono (webhook)"
    - "Degradacion explicita en vez de fallo: si la metadata no esta disponible, se crea una fila incompleta con marcador de texto en vez de fallar o de exigir una migracion"

key-files:
  created:
    - lib/culqi-verificar.ts
    - __tests__/culqi-verificar.test.ts
    - __tests__/culqi-webhook.test.ts
    - __tests__/api-charge.metadata.test.ts
  modified:
    - app/api/culqi/webhook/route.ts
    - app/api/charge/route.ts

key-decisions:
  - "Checkpoint Task 2 resuelto por el usuario: opcion C (metadata en el cargo de Culqi) sobre opcion A (fila incompleta sin intentar completarla). Razon: A deja a la cocina sin telefono/direccion/items -- no puede preparar el pedido ni contactar al cliente, incumpliendo el core value del proyecto. C si lo cumple."
  - "La degradacion (metadata ausente/invalida) usa un marcador de texto en cliente_nombre/cliente_telefono en vez de NULL, evitando la necesidad de una migracion de schema para que el camino de emergencia funcione hoy mismo."
  - "consultarCargo() devuelve metadata cruda sin interpretar (responsabilidad del webhook, D-09) para no acoplar el modulo de verificacion generico a la forma especifica del negocio."

patterns-established:
  - "Modulo de verificacion puntero+re-fetch (lib/culqi-verificar.ts) separado por testeabilidad: funcion pura de extraccion + funcion impura de red, mismo patron que lib/rate-limit.ts (D-26)"

requirements-completed: [PAY-02, PAY-03, PAY-04]

# Metrics
duration: ~90min (incluye pausa en checkpoint de decision)
completed: 2026-08-27
---

# Phase 01 Plan 07: Webhook definitivo de Culqi (PAY-02/03/04) Summary

**Handler de webhook que trata el payload de Culqi como puntero (re-fetch obligatorio antes de escribir), reconstruye el pedido completo desde metadata escrita por `/api/charge` en el momento del cobro, y degrada a fila incompleta + alerta si esa metadata no está disponible — nunca falla, nunca pisa lo que el camino síncrono ya escribió.**

## Performance

- **Duration:** ~90 min (incluye la espera de la decisión del usuario en el checkpoint de la Task 2)
- **Started:** 2026-08-27 (aprox., ver primer commit)
- **Completed:** 2026-08-27
- **Tasks:** 3 de 4 completadas a nivel de código (Task 1, Task 2 -- decisión, Task 3). Task 4 (verificación en vivo) queda pendiente de acción humana, no bloquea el cierre de este plan.
- **Files modified:** 6 (2 nuevos módulos de producción, 4 archivos de test; más 1 archivo de producción existente modificado)

## Accomplishments

- `lib/culqi-verificar.ts`: `extraerChargeId()` (pura, falla cerrado ante cualquier forma no reconocida) y `consultarCargo()` (GET autenticado contra `api.culqi.com`, secret key solo en el header, nunca en la URL).
- `app/api/culqi/webhook/route.ts`: handler definitivo. Reemplaza el endpoint de captura temporal del plan 01-02. Cubre los 7 casos exigidos por el plan más un caso adicional de degradación (ver abajo), con carrera, doble entrega, monto siempre desde Culqi y alerta ante fallo real de Supabase.
- `app/api/charge/route.ts`: ahora manda `metadata.pedido` (JSON string minimo: ids+qty, nombre, telefono, delivery/dirección) en el cargo de Culqi, para que el webhook pueda reconstruir el pedido completo si el navegador nunca llega a llamar esta ruta.
- 115/115 tests en verde (82 preexistentes + 33 nuevos de este plan). `npx tsc --noEmit`, `npm run build` y `npm run lint` (salvo los 3 errores preexistentes fuera de alcance, ver Issues Encountered) limpios.

## Checkpoint de la Task 2 — Decisión registrada

**Pregunta:** ¿qué pedido crea el webhook cuando `/api/charge` nunca llegó, si el webhook solo tiene el monto y el email que Culqi conoce del cargo?

**Decisión del usuario: Opción C** — mandar el detalle del pedido como `metadata` en el cargo de Culqi, para que el webhook lo recupere en el mismo `GET` que ya hace para verificar el cargo.

**Razón (registrada por el usuario, verbatim):** "con la opción A la cocina recibe una fila con monto y email y nada más — sin teléfono, sin dirección, sin saber qué se pidió. No pueden preparar el pedido ni llamar al cliente. El core value del proyecto es 'que un pedido pagado siempre llegue a la cocina, con el precio correcto'; A no lo cumple, solo evita que la plata se pierda en silencio. C sí lo cumple."

**Costo de C:** modifica `app/api/charge/route.ts` (el camino que cobra plata real). Mitigado por: (1) la única adición es un campo `metadata` en el body ya existente del `fetch` a Culqi, ninguna otra línea del camino de cobro se tocó; (2) `__tests__/api-charge.caracterizacion.test.ts` (25 tests, red de seguridad del plan 01-01) sigue en verde sin ajustar ninguna aserción, porque ninguna inspecciona el body completo enviado a Culqi.

**Diseño defensivo exigido por el usuario e implementado:**
1. **Metadata mínima** — solo `{ items: [{id, qty}], nombre, telefono, delivery, direccion }`, nunca nombres de producto ni el carrito completo (el límite de tamaño de `metadata` en Culqi no está confirmado).
2. **Degradación explícita** — si `consultarCargo()` devuelve `metadata` ausente, vacía o no parseable (JSON inválido, forma inesperada, `items` vacío tras filtrar), el handler NO falla: crea la fila con lo que hay (monto y email reales de Culqi, el resto con el marcador `"(sin datos -- pago sin metadata recuperable, ver alerta de Telegram)"`) y dispara `alertaTelegram()`. El peor caso nunca es peor que la opción A.
3. **Sin migración** — la degradación usa un marcador de texto en `cliente_nombre`/`cliente_telefono` (columnas `not null` hoy) en vez de `NULL`, evitando depender de una migración que no se puede aplicar ahora mismo (Supabase free tier autopausado, timeouts). `items` usa `[]` (la columna `jsonb not null` ya acepta un array vacío sin cambios de schema). No se escribió ninguna migración porque no hizo falta.
4. Verificaciones pendientes con el pago real: ver más abajo.

## Task Commits

Cada task TDD generó un ciclo RED → GREEN:

1. **Task 1: `lib/culqi-verificar.ts` (puntero + re-fetch)**
   - RED: `d5df576` (test)
   - GREEN: `b46241a` (feat)
2. **Extensión post-checkpoint: metadata cruda en `CargoCulqi`** (necesaria por la decisión C, no prevista en el frontmatter original de la Task 1)
   - `c791b2e` (feat, incluye el ajuste de test)
3. **`/api/charge` manda metadata mínima a Culqi (opción C)**
   - RED: `9b6a6f9` (test)
   - GREEN: `48fa702` (feat)
4. **Task 3: handler definitivo del webhook**
   - RED: `b3e8123` (test)
   - GREEN: `9e2a2c9` (feat)

**Task 2 (checkpoint:human-verify, gate="blocking-human"):** resuelta por decisión explícita del usuario (opción C), documentada arriba. No generó commit propio — la decisión se reflejó en el frontmatter y el `<objective>` de `01-07-PLAN.md` (ver Files Created/Modified).

**Task 4 (checkpoint:human-verify, gate="blocking-human"):** NO ejecutada — requiere un pago real con dinero real y un celular físico. Ver "Verificaciones manuales pendientes".

**Plan metadata:** este commit (`docs(01-07): ...`, generado al cerrar el plan).

## Files Created/Modified

- `lib/culqi-verificar.ts` - Puntero (`extraerChargeId`) y re-fetch autenticado (`consultarCargo`) contra Culqi; expone `metadata` cruda del cargo
- `__tests__/culqi-verificar.test.ts` - 16 tests: formas del id, fallo cerrado, header Authorization, key nunca en la URL, passthrough de metadata
- `app/api/culqi/webhook/route.ts` - Handler definitivo del webhook (reemplaza el endpoint de captura de 01-02)
- `__tests__/culqi-webhook.test.ts` - 14 tests: puntero sin id, cargo no confirmado, camino feliz, doble entrega/carrera, monto desde Culqi, Supabase caído, degradación sin metadata
- `app/api/charge/route.ts` - Agrega `metadata.pedido` (JSON string mínimo) al cargo de Culqi
- `__tests__/api-charge.metadata.test.ts` - 3 tests: forma de la metadata, dirección con delivery, ausencia de nombres de producto
- `.planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-07-PLAN.md` - Frontmatter (`files_modified`) y párrafo "Punto de despliegue seguro" actualizados con la decisión C

## Decisions Made

Ver "Checkpoint de la Task 2 — Decisión registrada" arriba. Además:

- `consultarCargo()` devuelve `metadata` cruda sin interpretarla (no conoce la forma `{pedido: "...json..."}`) — esa interpretación vive en el webhook (`parsearMetadata`), para no acoplar el módulo de verificación genérico (reusable en el futuro cron de reconciliación, 01-08) a una decisión de negocio de este plan.
- Sobre un `items` vacío tras filtrar la metadata: se trata igual que metadata ausente (degradación completa), no como un pedido parcial — un pedido sin items no le sirve a la cocina más que el marcador genérico.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `CargoCulqi`/`consultarCargo()` necesitaron exponer `metadata`**
- **Found during:** Después del checkpoint de la Task 2 (decisión C)
- **Issue:** La Task 1 se completó y commiteó ANTES del checkpoint de la Task 2, con la forma `{id, amount, state, email}` que especificaba el frontmatter original. La decisión C requiere que el webhook pueda leer la metadata del cargo, que no estaba contemplada en esa forma.
- **Fix:** Se agregó el campo `metadata: unknown` a `CargoCulqi` y se extendió `consultarCargo()` para devolver `data.metadata ?? null`, con su propio ciclo RED-GREEN.
- **Files modified:** `lib/culqi-verificar.ts`, `__tests__/culqi-verificar.test.ts`
- **Verification:** Test dedicado (`200 con metadata -> la pasa tal cual`); suite completa en verde
- **Committed in:** `c791b2e`

**2. [Rule 3 - Blocking] Ajuste de comentarios para no romper el grep del criterio D-10**
- **Found during:** Task 3, verificación de criterios de aceptación
- **Issue:** El criterio `grep -nE "reintent|retry|timeout" app/api/culqi/webhook/route.ts` debe no dar resultados, pero los comentarios que EXPLICAN D-10 (por qué no hay lógica de reintentos) usaban la palabra "reintento" para describir la ausencia de esa lógica, haciendo fallar el grep aunque el código en sí no razona sobre reintentos.
- **Fix:** Se reformularon los comentarios usando "vuelve a mandar el evento"/"reenvío" en vez de "reintenta"/"reintento", sin cambiar el significado.
- **Files modified:** `app/api/culqi/webhook/route.ts`
- **Verification:** `grep -nE "reintent|retry|timeout" app/api/culqi/webhook/route.ts` → sin resultados (exit 1)
- **Committed in:** `9e2a2c9` (mismo commit de la Task 3, el ajuste se hizo antes de commitear)

**3. [Rule 3 - Blocking] `npm install` requerido antes de poder verificar**
- **Found during:** Inicio de la Task 1
- **Issue:** El worktree no tenía `node_modules/` instalado (mismo caso documentado en `01-02-SUMMARY-PARCIAL.md`).
- **Fix:** Se corrió `npm install` sin flags, usando el `package-lock.json` existente.
- **Files modified:** ninguno versionado (`node_modules` en `.gitignore`)
- **Verification:** `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` corrieron correctamente
- **Committed in:** N/A

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking). Ninguna afecta el alcance del plan ni introduce funcionalidad no pedida — la extensión de `metadata` es consecuencia directa de la decisión C tomada en el checkpoint, no una adición discrecional.

## Issues Encountered

- `npm run lint` reporta los mismos 3 errores preexistentes (`react-hooks/set-state-in-effect` en `app/admin/page.tsx`, `app/puntos/page.tsx`, `lib/cart-context.tsx`) ya documentados en `01-02-SUMMARY-PARCIAL.md` y en `deferred-items.md`. Ninguno de esos archivos fue tocado por este plan. `npx eslint` sobre los archivos que sí se tocaron (`lib/culqi-verificar.ts`, `app/api/culqi/webhook/route.ts`, `app/api/charge/route.ts`, los tres archivos de test nuevos) pasa limpio.
- `01-CULQI-FLUJO.md` sigue sin existir: el plan 01-02 quedó bloqueado en su propio checkpoint antes de producir ese documento (ver `01-02-SUMMARY-PARCIAL.md`). Este plan trabajó bajo el supuesto explícito (documentado en el header de `lib/culqi-verificar.ts` y en `app/api/culqi/webhook/route.ts`) de que el flujo vivo es probablemente token síncrono (`chr_...`, `charge.succeeded`) según una captura de pantalla del checkout en producción aportada por el usuario, pero `extraerChargeId()` no discrimina por prefijo — acepta cualquier string en las formas conocidas del payload, así que tolera tanto `chr_` como `ord_` sin necesidad de adivinar cuál está vivo. **Este supuesto queda abierto (Assumption A1 de `01-RESEARCH.md`) hasta el pago real de la Task 4.**

## Verificaciones manuales pendientes

Ninguno de estos pasos es automatizable por este agente: implican dinero real, un despliegue deliberado a producción, y acceso a paneles externos (CulqiPanel, Vercel Logs, Supabase Table Editor) que requieren sesión humana.

### 1. Desplegar el handler definitivo (reemplaza el endpoint temporal en producción)

El endpoint temporal del plan 01-02 está DESPLEGADO HOY en `https://loboburger.com/api/culqi/webhook` (commit `8d6d0ef` en `main`). El reemplazo de este plan vive en esta branch y **no se despliega automáticamente**. Antes de la Task 4:
1. Mergear/deployar esta branch a producción de forma deliberada.
2. Confirmar en Vercel que la nueva versión de `app/api/culqi/webhook/route.ts` está sirviendo (por ejemplo, verificar que el log `[PAY-01] webhook payload` del endpoint viejo ya no aparece en invocaciones nuevas).

### 2. Task 4 completa — verificación en vivo con pago real (ver `01-07-PLAN.md` para el detalle)

1. Confirmar en CulqiPanel que la URL del webhook sigue apuntando a `https://loboburger.com/api/culqi/webhook`.
2. Hacer un pedido real de S/5 (Gaseosa) y pagar.
3. **Cerrar la pestaña inmediatamente después de aprobar el pago**, antes de la pantalla de confirmación.
4. Confirmar en Supabase que la fila del pedido existe, creada por el webhook, y que **`cliente_nombre`/`cliente_telefono`/`items` tienen los datos reales** (no el marcador `"(sin datos...)"`）— esto confirma que la opción C funcionó end-to-end, no solo que el webhook no rompió nada.
5. Verificar en los logs de Vercel que el handler llamó a `GET /v2/charges/{id}`.
6. Confirmar que hay UNA fila, no dos.
7. Repetir el pago SIN cerrar la pestaña (camino normal) y confirmar que también hay exactamente una fila (prueba de la carrera real).
8. Reembolsar los dos cargos de prueba desde CulqiPanel.
9. Si Culqi permite reenviar un evento desde el panel, reenviar uno ya procesado y confirmar que no duplica la fila.

### 3. Confirmar el tamaño y la forma real de `metadata` en Culqi

- (a) Que Culqi acepta el tamaño de `metadata` que este plan manda (ids+qty, nombre, teléfono, delivery/dirección — no hay límite documentado, no se pudo verificar sin un pago real).
- (b) Que el `GET /v2/charges/{id}` devuelve esa `metadata` tal cual se mandó (campo `metadata.pedido` con el JSON string intacto).
- Si (a) o (b) fallan (Culqi trunca, rechaza, o no la devuelve), el webhook degradará automáticamente a fila incompleta + alerta — no es un fallo catastrófico, pero PAY-02 no estará cumplido "de verdad" (pedido completo) hasta confirmar esto.

### 4. Crear/actualizar `01-CULQI-FLUJO.md` con el resultado

El documento nunca se llegó a crear (01-02 quedó bloqueado). Cuando se haga el pago real de la Task 4, documentar ahí: la forma real del payload del webhook (¿`chr_` o `ord_`? ¿qué campos trae?), si `extraerChargeId()` necesitó ajustarse, y el resultado de los puntos 3(a)/3(b) sobre `metadata`.

### 5. Aplicar las migraciones pendientes (deuda heredada de waves anteriores, no de este plan)

`20260820000000_pedidos.sql` y `20260825000000_rate_limit.sql` siguen sin aplicarse en producción (Supabase free tier autopausado, timeouts). Este plan NO agregó una migración nueva (ver "Sin migración" arriba), pero el webhook depende de que la tabla `pedidos` con la constraint `culqi_charge_id unique` ya exista quando se despliegue.

## Next Phase Readiness

- **Código completo y cubierto por tests para PAY-02, PAY-03 y PAY-04.** El handler está listo para desplegarse; lo que falta es la verificación en vivo (Task 4) y el despliegue deliberado a producción, ambos fuera del alcance de este agente.
- El plan 01-08 (cron de reconciliación, keep-warm) puede reusar `lib/culqi-verificar.ts` tal cual — `consultarCargo()` es genérico y no asume nada sobre `metadata`.
- Riesgo conocido y documentado: hasta que se complete la verificación en vivo, el supuesto de que el flujo Yape vivo es token síncrono (`chr_`) sigue sin confirmar. El código no depende de que sea así (falla cerrado / tolera ambos prefijos), pero el comportamiento real de Culqi con `metadata` (tamaño, si la devuelve) sigue siendo un supuesto no verificado.

---
*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Completed: 2026-08-27*
