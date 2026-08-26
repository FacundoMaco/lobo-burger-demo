---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 01
subsystem: testing-infra
tags: [vitest, tdd, caracterizacion, infra-04]
dependency-graph:
  requires: []
  provides:
    - "Runner de tests Vitest (npm run test / test:run)"
    - "Mock encadenable de getSupabaseAdmin() (__tests__/helpers/supabase-mock.ts)"
    - "Caracterizacion en verde de app/api/charge/route.ts"
  affects:
    - "app/api/charge/route.ts (solo lectura/tests, cero cambios de codigo)"
tech-stack:
  added:
    - "vitest@4.1.11"
    - "@vitejs/plugin-react@6.1.0"
    - "vite-tsconfig-paths@6.1.1"
    - "jsdom@30.0.1"
  patterns:
    - "Caracterizacion antes de refactor (D-25): tests contra el comportamiento actual, gate invertido"
    - "vi.stubGlobal('fetch', vi.fn()) + vi.unstubAllGlobals()/vi.unstubAllEnvs()/vi.restoreAllMocks() en beforeEach/afterEach para evitar fugas entre tests"
    - "@vitest-environment node por archivo, cuando el entorno global es jsdom"
key-files:
  created:
    - vitest.config.mts
    - __tests__/menu.test.ts
    - __tests__/helpers/supabase-mock.ts
    - __tests__/api-charge.caracterizacion.test.ts
    - .planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-HALLAZGOS-CARACTERIZACION.md
    - .planning/phases/01-integridad-del-pago-y-red-de-seguridad/deferred-items.md
  modified:
    - package.json
    - package-lock.json
decisions:
  - "vitest instalado con --legacy-peer-deps: shadcn arrastra @babel/core@7.x, @vitejs/plugin-react@6 trae un peer opcional de @babel/core@8.x via @rolldown/plugin-babel. Sin conflicto real de runtime, solo de resolucion de peers de npm."
  - "getSupabaseAdmin mock requiere mockClear() explicito en cada configuracion: restoreAllMocks() de Vitest no limpia el historial de llamadas de un vi.fn() creado dentro de un factory de vi.mock() de nivel de modulo (solo aplica de lleno a vi.spyOn)."
metrics:
  duration: "~2h (incluye checkpoint bloqueante de aprobacion humana)"
  completed: 2026-08-26
---

# Phase 1 Plan 01: Runner de tests + caracterizacion de /api/charge Summary

Vitest levantado desde cero en un repo sin ningun test previo, y el handler de
cobro (`app/api/charge/route.ts`) congelado en 28 tests de caracterizacion que
pasaron en verde al primer intento, sin tocar una sola linea de produccion.

## Lo que se construyo

**Task 1 — Checkpoint de legitimidad de paquetes (aprobado por humano).**
`vitest` fue marcado `SUS`/`TYPOSQUAT_RISK` por slopcheck en la research. El
usuario confirmo explicitamente que es el paquete oficial del ecosistema Vite
(`vitest-dev/vitest`) tras revisar npm/GitHub. Aprobado.

**Task 2 — Runner de Vitest.** `vitest.config.mts` siguiendo la guia oficial
de Next 16 (leida directo de `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`
en este repo, no de memoria): `tsconfigPaths()` + `react()`, entorno `jsdom`
por defecto. Scripts `test` (watch) y `test:run` (una pasada, exit code util
para gates). Smoke test contra `lib/menu.ts` via el alias `@/*`.

**Task 3 — Caracterizacion de `app/api/charge/route.ts`.** Mock encadenable
de `getSupabaseAdmin()` en `__tests__/helpers/supabase-mock.ts` (reusable por
los planes 01-03/05/06/07/08). 28 tests cubriendo: configuracion faltante,
body invalido, recalculo del precio contra `lib/menu.ts` (incluyendo el test
antiregresion explicito que ignora `amount`/`total` enviados por el cliente),
bounds (`MAX_QTY`, `MAX_CENTS`, `MIN_CENTS` documentado como inalcanzable),
delivery, cargo rechazado por Culqi, camino feliz, idempotencia `23505`, y
las dos ramas de fallo de Supabase tras un cargo exitoso (insert con error
distinto de `23505`, y excepcion de `getSupabaseAdmin()`).

## Verificacion antiregresion manual (obligatoria, ejecutada y revertida)

Se rompio produccion a proposito para confirmar que el test antiregresion
realmente protege algo: se agrego una linea en `app/api/charge/route.ts` que
sobreescribe `totalCents` con `body.amount` si el cliente lo manda
(replicando el exploit historico exacto). Resultado: `npm run test:run` fallo
**exactamente 1 de 28 tests** — `ANTIREGRESION -- ignora un amount/total
enviado por el cliente y sigue cobrando 4100` (`expected 300 to be 4100`). Los
otros 27 siguieron en verde. El cambio se revirtio de inmediato; nunca se
commiteo (`git diff --exit-code -- app/ lib/` volvio a exit code 0 antes del
commit de Task 3).

## Resultado del gate de caracterizacion (D-25)

GATE VERDE al primer intento. Cero bugs preexistentes encontrados. Unica
observacion (no es un bug): `MIN_CENTS` (300 centimos) es hoy inalcanzable
con la carta vigente — el item mas barato es la Gaseosa a 500 centimos. No se
escribio un test que finja cubrir esa rama. Detalle completo en
`01-HALLAZGOS-CARACTERIZACION.md`.

## TDD Gate Compliance

Este plan es `type: tdd`, pero Task 3 es caracterizacion con **gate
invertido** por diseno explicito (D-25): tests contra el comportamiento
ACTUAL, verlos pasar en verde SIN tocar produccion, y recien ahi (en planes
futuros) extraer/refactorizar. No hay una secuencia RED→GREEN clasica en esta
tarea porque no hay comportamiento nuevo que agregar — el commit de Task 3 es
`test(01-01): ...` sin un `feat(...)` posterior, y eso es correcto: agregar
un `feat` habria significado tocar `app/api/charge/route.ts` en este plan,
justo lo que D-25/Pitfall C de la research prohiben. Task 2 (levantar el
runner) tampoco es TDD clasico porque no hay logica de negocio que probar
primero — es infraestructura, cubierta con un smoke test que confirma que el
runner y el alias funcionan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Conflicto de peer dependencies al instalar `@vitejs/plugin-react`**
- **Found during:** Task 1 (instalacion de paquetes ya aprobados)
- **Issue:** `npm install` fallaba con `ERESOLVE`: `shadcn` arrastra
  `@babel/core@7.x` via `@babel/preset-typescript`, mientras
  `@vitejs/plugin-react@6.1.0` trae un peer **opcional** de
  `@babel/core@8.x` via `@rolldown/plugin-babel`. No es un conflicto de
  runtime real (el peer de babel@8 es opcional y no se usa en este proyecto).
- **Fix:** instalado con `--legacy-peer-deps`. Mismos 4 paquetes, mismas
  versiones exactas aprobadas en Task 1 — no se sustituyo ningun paquete.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `69d90ab`

**2. [Rule 1 - Bug] `getSupabaseAdmin` mock arrastraba llamadas entre tests**
- **Found during:** Task 3, al escribir el test "cargo rechazado por Culqi
  ... no llama a Supabase"
- **Issue:** `vi.restoreAllMocks()` en `afterEach` no limpia el historial de
  llamadas de un `vi.fn()` creado dentro del factory de `vi.mock()` (solo
  aplica de lleno a mocks creados con `vi.spyOn`). El assert
  `expect(getSupabaseAdmin).not.toHaveBeenCalled()` fallaba con 5 llamadas
  acumuladas de tests anteriores en el mismo archivo.
- **Fix:** `useSupabaseMock()` ahora llama `vi.mocked(getSupabaseAdmin).mockClear()`
  antes de configurar el `mockReturnValue` en cada test/beforeEach.
- **Files modified:** `__tests__/api-charge.caracterizacion.test.ts`
- **Commit:** `c8d71d8`

### Out-of-scope (documentado en deferred-items.md, no corregido)

**3. [Fuera de scope] 3 errores preexistentes de `react-hooks/set-state-in-effect`**
- `npm run lint` reporta errores en `app/admin/page.tsx:320`,
  `app/puntos/page.tsx:121` y `lib/cart-context.tsx:60` — preexistentes desde
  el commit `eb9f243`, ninguno de los tres archivos fue tocado por este plan.
  No corregidos (fuera del scope de INFRA-04). Documentado en
  `.planning/phases/01-integridad-del-pago-y-red-de-seguridad/deferred-items.md`.

## Known Stubs

Ninguno. Este plan no crea componentes de UI ni datos mockeados que lleguen a
produccion; los mocks son exclusivamente de tests.

## Threat Flags

Ninguno. El unico paquete de terceros nuevo (`vitest`) ya estaba en el threat
register del plan (T-01-SC) y paso por el checkpoint bloqueante de Task 1.

## Verification

- `npm run test:run`: 28/28 tests en verde, exit code 0
- `npx tsc --noEmit`: sin errores
- `npm run lint`: sin errores nuevos (3 preexistentes documentados como
  fuera de scope)
- `git diff --exit-code -- app/ lib/`: exit code 0 (cero cambios de
  produccion en el estado final)
- Verificacion antiregresion manual: ejecutada y revertida (ver seccion
  arriba)

## Commits

- `69d90ab` — chore(01-01): instalar vitest y dependencias de testing
- `c72bed2` — feat(01-01): levantar runner de Vitest con smoke test del alias @/*
- `c8d71d8` — test(01-01): caracterizar app/api/charge/route.ts en verde (D-25)

## Next Steps

Los planes 01-03, 01-05 y 01-06 quedan habilitados para tocar
`app/api/charge/route.ts` con la red de caracterizacion debajo (`npm run
test:run` como gate de regresion antes de cada cambio).

## Self-Check: PASSED

Todos los archivos creados (`vitest.config.mts`, `__tests__/menu.test.ts`,
`__tests__/helpers/supabase-mock.ts`,
`__tests__/api-charge.caracterizacion.test.ts`,
`01-HALLAZGOS-CARACTERIZACION.md`, `deferred-items.md`, este `SUMMARY.md`) y
los 4 commits (`69d90ab`, `c72bed2`, `c8d71d8`, `8cbc675`) fueron verificados
contra el filesystem y `git log` respectivamente.
