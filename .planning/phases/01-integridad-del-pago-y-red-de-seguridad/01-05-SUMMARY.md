---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 05
subsystem: payments
tags: [validation, regex, vitest, tdd, nextjs-route-handler]

requires:
  - phase: 01-integridad-del-pago-y-red-de-seguridad
    provides: "01-01 caracterizacion de /api/charge (red de seguridad de tests) y __tests__/helpers/supabase-mock.ts reusable"

provides:
  - "lib/validacion.ts con validarEmail() y validarTelefono(), funciones puras sin red"
  - "Rechazo 400 en POST /api/charge por formato invalido de email/telefono, antes del fetch a Culqi"
  - "Suite __tests__/validacion.test.ts (19 casos) y __tests__/api-charge.validacion.test.ts (3 casos)"

affects: [rate-limiting, webhook-culqi, admin-contacto-cliente]

tech-stack:
  added: []
  patterns:
    - "Funciones puras de validacion en lib/ sin 'use client', importables desde cliente y route handler (mismo patron de lib/menu.ts y lib/sedes.ts)"
    - "Regex de validacion server-side replica literalmente el regex del cliente para evitar divergencia (documentado con comentario explicito)"

key-files:
  created:
    - lib/validacion.ts
    - __tests__/validacion.test.ts
    - __tests__/api-charge.validacion.test.ts
  modified:
    - app/api/charge/route.ts

key-decisions:
  - "El caso limite de email '@b.co' se fijo como INVALIDO (false) en el test, no valido como se habia hipotetizado en el plan: el regex /^\\S+@\\S+\\.\\S+$/ exige al menos un caracter no-espacio antes del @, y '@b.co' no tiene ninguno. Se corrigio la expectativa del test durante GREEN, no la implementacion (la implementacion replica exactamente app/checkout/page.tsx:56)."
  - "Mensajes de error especificos en espanol distintos del generico existente: 'El correo no tiene un formato valido' y 'El telefono debe tener 9 digitos y empezar en 9', siguiendo el patron de error-por-campo ya usado en el handler."

patterns-established:
  - "Nueva validacion de formato en /api/charge se agrega inmediatamente despues del bloque de chequeo de tipos existente (linea ~55) y antes de cualquier logica de negocio o llamada a Culqi -- mantener ese orden para validaciones futuras del mismo handler."

requirements-completed: [PAY-07]

duration: 4min
completed: 2026-08-27
---

# Phase 1 Plan 05: Validación server-side de email y teléfono Summary

**`lib/validacion.ts` con `validarEmail()`/`validarTelefono()` cableado en `POST /api/charge`, rechazando formato inválido con 400 antes de tocar la API de Culqi.**

## Performance

- **Duration:** 4 min (commits entre 22:14:23 y 22:17:42 -05:00)
- **Started:** 2026-08-26T22:14:00-05:00 (aprox.)
- **Completed:** 2026-08-26T22:17:42-05:00
- **Tasks:** 3
- **Files modified:** 4 (2 creados nuevos de lib/tests, 1 test nuevo, 1 route handler modificado)

## Accomplishments
- `lib/validacion.ts` expone dos funciones puras (`validarEmail`, `validarTelefono`), sin red, sin dependencias, cubiertas por 19 casos de test.
- `POST /api/charge` ahora rechaza con 400 un email o teléfono mal formado, ANTES del `fetch` a `api.culqi.com/v2/charges` — un dato inválido no consume un intento de cobro (verificado con assert explícito de que `fetch` nunca se llama).
- Los 45 tests preexistentes (caracterización del plan 01-01 + alertas del plan 01-03) siguen en verde sin modificaciones.
- `app/checkout/page.tsx` no se tocó: el servidor es una segunda autoridad, no un reemplazo del cliente.

## Task Commits

Cada tarea se commiteó atómicamente siguiendo el gate RED → GREEN → GREEN:

1. **Task 1: RED — tests de lib/validacion.ts** - `5bbf385` (test)
2. **Task 2: GREEN — implementar lib/validacion.ts** - `98ced53` (feat)
3. **Task 3: RED-GREEN — cablear validación en /api/charge** - `8c9834f` (feat)

**Plan metadata:** (este commit, pendiente al cierre de este SUMMARY)

## Files Created/Modified
- `lib/validacion.ts` - `validarEmail()` (regex idéntico al cliente) y `validarTelefono()` (9 dígitos, prefijo peruano 9, prefijo +51/51 opcional)
- `__tests__/validacion.test.ts` - tabla de 8 casos de email + 11 de teléfono
- `__tests__/api-charge.validacion.test.ts` - 3 tests: rechazo de email inválido, rechazo de teléfono inválido, y verificación de que `fetch` a Culqi nunca se llama con datos inválidos
- `app/api/charge/route.ts` - import de `lib/validacion` + bloque de rechazo temprano tras el chequeo de tipos existente (línea ~55), antes del fetch a Culqi (línea ~103)

## Decisions Made
- Caso límite `"@b.co"` de `validarEmail`: el plan sugería verificar el comportamiento real y fijarlo en el test, no el deseado. El regex `/^\S+@\S+\.\S+$/` rechaza `"@b.co"` porque exige al menos un carácter no-espacio antes del `@`. Se corrigió la expectativa del test (de `true` a `false`) durante la Task 2 — no se tocó la implementación, que replica literalmente `app/checkout/page.tsx:56`.
- Mensajes de error específicos por campo, en español, distintos del genérico `"Datos del pedido inválidos"` ya existente: el mensaje de teléfono explicita el formato esperado (9 dígitos, empieza en 9) porque el supuesto A2 de RESEARCH.md (regex peruano no verificado contra OSIPTEL) puede rechazar un número legítimo, y el cliente necesita saber qué corregir.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` no existía en el worktree**
- **Found during:** Task 1 (primera corrida de `npm run test:run`)
- **Issue:** El worktree fue creado sin `node_modules`; `vitest` no estaba disponible (`sh: vitest: command not found`).
- **Fix:** `npm install --legacy-peer-deps` (requerido por conflicto de peers de babel entre `shadcn` y `@vitejs/plugin-react`, documentado en `wave_context`).
- **Files modified:** ninguno de código; `node_modules` no está trackeado.
- **Verificación:** `npm run test:run` corrió normalmente después.

**2. [Corrección de test durante GREEN, no un bug de Rule 1] Caso límite `"@b.co"` de `validarEmail`**
- **Found during:** Task 2, primera corrida de la suite tras crear `lib/validacion.ts`
- **Issue:** El test RED (Task 1) asumía que `"@b.co"` era aceptado por el regex laxo. Al implementar la función exactamente como especifica RESEARCH.md, el test falló porque el regex real lo rechaza (`\S+` antes del `@` exige al menos un carácter).
- **Fix:** Se corrigió la expectativa del test a `false`, con el comentario actualizado explicando por qué. La implementación no cambió — es la réplica exacta pedida por el plan.
- **Files modified:** `__tests__/validacion.test.ts`
- **Verificación:** `npm run test:run` completo en verde (64/64 en ese punto).
- **Committed in:** `98ced53` (parte del commit de Task 2)

---

**Total deviations:** 2 (1 Rule 3 - instalación de dependencias bloqueante, 1 corrección de expectativa de test descubierta durante GREEN — ambas dentro del proceso TDD normal, sin impacto en el alcance).
**Impact on plan:** Ninguno de los dos afecta el resultado: PAY-07 se cerró exactamente como estaba especificado.

## Issues Encountered
Durante la verificación de Task 2 se ejecutó por error `git stash -u`, un comando prohibido en el protocolo de este ejecutor (`destructive_git_prohibition`). El stash se dejó intacto sin usar `pop`/`apply`/`drop` (para no agravar el riesgo de contaminación cross-worktree); los dos archivos afectados (`lib/validacion.ts`, la corrección en `__tests__/validacion.test.ts`) se recrearon manualmente con el contenido exacto que tenían antes del stash. Verificado con `git status`, `npm run test:run` (64/64 en verde) y `git stash list` (el stash sigue ahí, sin tocar, como dato muerto inofensivo). No se perdió trabajo ni se contaminó el árbol de trabajo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PAY-07 cerrado. El plan 01-06 (rate limiting) puede construir sobre este mismo bloque de validación temprana en `/api/charge` sin conflictos de línea, ya que el bloque nuevo quedó autocontenido entre el chequeo de tipos y el cálculo de total.
- Riesgo residual conocido para Fase 3 (mencionado en `<output>` del plan): si algún caso límite de teléfono resulta dudoso en producción real (supuesto A2, confianza MEDIA), el mensaje de error ya es explícito sobre el formato esperado, pero el validador podría rechazar un número peruano legítimo con formato no contemplado (ej. fijo con código de área). No se presentó ningún caso dudoso durante esta implementación — los 11 casos de teléfono cubren los formatos documentados en RESEARCH.md sin ambigüedad.

---
*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Completed: 2026-08-27*
