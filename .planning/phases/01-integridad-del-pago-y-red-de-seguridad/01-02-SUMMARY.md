---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 02
subsystem: payments
tags: [culqi, webhook, nextjs, route-handler]

# Dependency graph
requires: []
provides:
  - "Endpoint temporal `app/api/culqi/webhook/route.ts` que captura el payload crudo de cualquier POST de Culqi, sin escribir en Supabase ni llamar a la API de Culqi"
affects: [01-07 (handler definitivo del webhook)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route handler que lee request.text() en vez de request.json() para no perder payloads no-JSON"

key-files:
  created: [app/api/culqi/webhook/route.ts]
  modified: []

key-decisions:
  - "Ninguna decisión arquitectónica nueva — se siguió el plan tal cual para la Task 1"

patterns-established: []

requirements-completed: []  # PAY-01 NO esta resuelto todavia: bloqueado en el checkpoint humano (Task 2)

# Metrics
duration: N/A - EJECUCION PAUSADA EN CHECKPOINT
completed: PENDIENTE
---

# Phase 01 Plan 02: Verificación del flujo Culqi (PAY-01) — Summary PARCIAL

**EJECUCIÓN PAUSADA EN CHECKPOINT — Task 1 completada (endpoint de captura desplegable), Task 2 requiere un pago real de Yape en producción que solo un humano con un celular puede hacer, Task 3 (documentar 01-CULQI-FLUJO.md) no se ejecutó porque depende del resultado de la Task 2.**

## Performance

- **Duration:** N/A (ejecución interrumpida en checkpoint, no completada)
- **Started:** 2026-08-26T20:35:00Z (aprox.)
- **Paused:** 2026-08-26T20:37:21Z
- **Tasks:** 1/3 completada
- **Files modified:** 1

## Accomplishments

- Se creó `app/api/culqi/webhook/route.ts`, un endpoint POST desplegable que:
  - Lee el body con `request.text()` (nunca `request.json()`) para no perder payloads no-JSON.
  - Loguea una línea `[PAY-01] webhook payload` con content-type, nombres de header (nunca valores) y el body crudo completo.
  - Devuelve `200` sin escribir en ningún lado.
- Verificado contra `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (leído en esta sesión, dependencias instaladas con `npm install` porque `node_modules` no existía en el worktree): el cambio de caching por defecto de Next 15 aplica solo a `GET`; un `POST` no se prerrenderiza, así que **no hace falta `export const dynamic = "force-dynamic"`**. Confirmado también por el build: la ruta aparece como `ƒ` (dinámica) sin esa línea.
- `proxy.ts` queda sin diff (`git diff --exit-code -- proxy.ts` = 0): el matcher sigue acotado a `/admin/:path*` y `/api/admin/:path*` (D-11).
- `npm run build`, `npx tsc --noEmit` y `npx eslint app/api/culqi/webhook/route.ts` pasan limpios.

## Task Commits

1. **Task 1: Endpoint temporal de captura del payload del webhook** - `97f2d8e` (feat)

**Task 2 (checkpoint:human-verify, gate="blocking-human"): NO EJECUTADA.**
**Task 3 (documentar 01-CULQI-FLUJO.md): NO EJECUTADA — depende de la Task 2.**

## Files Created/Modified

- `app/api/culqi/webhook/route.ts` - Endpoint temporal de captura del payload crudo de Culqi, deliberadamente descartable (lo reemplaza el plan 01-07)

## Decisions Made

None — se siguió el plan tal cual para la Task 1. La única aclaración técnica (no requerir `force-dynamic`) está documentada arriba y respaldada por la doc oficial leída en esta sesión, no por conocimiento previo (regla explícita de `AGENTS.md`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ajuste de redacción de comentarios para cumplir el criterio de aceptación literal**
- **Found during:** Task 1, verificación de criterios de aceptación
- **Issue:** El criterio de aceptación exige `grep -c 'request.json()' app/api/culqi/webhook/route.ts` = 0. Los comentarios explicativos del código mencionaban literalmente `request.json()` para explicar por qué no se usa, lo que hacía fallar ese grep aunque el código en sí nunca llama a `request.json()`.
- **Fix:** Se reformuló el comentario para explicar lo mismo sin usar la cadena literal `request.json()`.
- **Files modified:** `app/api/culqi/webhook/route.ts`
- **Verification:** `grep -c 'request.json()' app/api/culqi/webhook/route.ts` → 0; `grep -c 'request.text()'` → 1
- **Committed in:** `97f2d8e` (Task 1 commit)

**2. [Rule 3 - Blocking] `npm install` requerido antes de poder verificar**
- **Found during:** Inicio de Task 1
- **Issue:** El worktree no tenía `node_modules/` instalado, por lo que ni `node_modules/next/dist/docs/` (requerido por `AGENTS.md` antes de escribir código) ni `npx tsc`/`npm run lint`/`npm run build` (criterios de verificación de la Task 1) estaban disponibles.
- **Fix:** Se corrió `npm install` (sin flags, usando el `package-lock.json` existente, ningún paquete nuevo agregado a `package.json`).
- **Files modified:** ninguno versionado (node_modules está en `.gitignore`)
- **Verification:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` disponible; `npx tsc --noEmit`, `npm run lint`, `npm run build` corrieron
- **Committed in:** N/A (no se commitea `node_modules`)

---

**Total deviations:** 2 auto-fixed (2 blocking). Ninguna afecta el alcance del plan ni introduce funcionalidad no pedida.

## Issues Encountered

- `npm run lint` reporta 3 errores preexistentes en `app/puntos/page.tsx` y `lib/cart-context.tsx` (regla `react-hooks/set-state-in-effect`), en archivos que esta plan NO toca. Fuera de alcance (SCOPE BOUNDARY): no se tocaron. `npx eslint app/api/culqi/webhook/route.ts` (el único archivo de esta plan) pasa limpio sin ningún error.

## User Setup Required

**Sí — bloqueante para continuar el plan.** La Task 2 (checkpoint `type="checkpoint:human-verify" gate="blocking-human"`) requiere que un humano:

1. Confirme que el endpoint de la Task 1 está desplegado en producción (`https://loboburger.com/api/culqi/webhook`).
2. Registre el webhook en CulqiPanel → Desarrollo → Webhooks, suscribiendo tanto `charge.succeeded` como `order.status.changed` si ambos están disponibles.
3. Inspeccione el widget de checkout en producción (¿aparece Yape? ¿qué propiedad del callback `culqi.culqi` queda definida: `culqi.token` u `culqi.order`?).
4. Haga un pago real con Yape de S/5 (mínimo de Culqi S/3, ítem más barato de la carta S/5 — la Gaseosa) desde un celular real.
5. Capture el payload del webhook en los logs de Vercel filtrando por `[PAY-01]`.
6. Corra un `curl` con `Authorization: Bearer $CULQI_SECRET_KEY` contra `GET https://api.culqi.com/v2/charges/{id}` para cerrar el supuesto A5.
7. Reembolse el cargo de prueba en CulqiPanel → Cargos.
8. Si se creó una fila en `pedidos`, la borre desde el Table Editor de Supabase.

Ninguno de estos pasos es automatizable por este agente: implican dinero real, una app de Yape en un celular físico, y acceso a paneles externos (CulqiPanel, Vercel Logs, Supabase Table Editor) que requieren sesión humana. Ver la Task 2 completa en `01-02-PLAN.md` para el detalle exacto de qué reportar en cada paso.

## Next Phase Readiness

- **NO lista.** El plan 01-02 queda incompleto: falta la Task 2 (checkpoint humano) y la Task 3 (`01-CULQI-FLUJO.md`, entrada obligatoria del plan 01-07).
- El plan 01-07 (webhook definitivo) **no puede arrancar** hasta que este plan se retome y complete, porque necesita saber con certeza qué flujo de Yape está vivo (`chr_` vs `ord_`) y la forma real del payload.
- El endpoint temporal de la Task 1 es seguro de dejar desplegado mientras tanto: no escribe nada, y hoy no hay ningún webhook configurado en Culqi que le mande tráfico.

---
*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Status: PAUSADO EN CHECKPOINT (Task 2 de 3)*
