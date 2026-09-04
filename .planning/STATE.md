---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 2 UI-SPEC approved
last_updated: "2026-09-02T02:42:00.661Z"
last_activity: 2026-08-26 -- Phase 01 execution started
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 8
  completed_plans: 7
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** Que un pedido pagado siempre llegue a la cocina, con el precio correcto, y que nadie pueda pagar cuando el local no puede cumplirlo.
**Current focus:** Phase 01 — integridad-del-pago-y-red-de-seguridad

## Current Position

Phase: 01 (integridad-del-pago-y-red-de-seguridad) — EXECUTING
Plan: 1 of 8
Status: Executing Phase 01
Last activity: 2026-09-04 - Completed quick task 260904-9yt: Derivar CATEGORIAS_CON_CREMAS de CATEGORIES

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0h

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisiones completas en PROJECT.md → Key Decisions. Relevantes para el arranque:

- Roadmapping: fase 1 blinda el camino del dinero (webhook, idempotencia, alertas, rate limit, tests) antes de tocar menú, operación, tracking o analítica — todo lo demás depende de `/api/charge` ya endurecido.
- PAY-01 (verificar flujo Yape real chr_ vs ord_) debe resolverse ANTES de diseñar el webhook, dentro de la Fase 1 — no es un prerequisito separado.
- MENU-01 (menú a Supabase) va en Fase 2 porque OPS-04 (agotado) y MENU-03 (edición de precio) dependen estructuralmente de ella.
- DELV-01/DELV-02 van juntos en Fase 3: agregar tarifa de delivery sin mover la validación de radio de 7.5km a `/api/charge` reabriría un input client-trusted.

### Pending Todos

Ninguno registrado aún.

### Blockers/Concerns

- [Fase 1] PAY-01 bloqueado externamente: estado de verificación de la cuenta Culqi test (`DNGA9999`) pendiente de Culqi/Jaime — necesario antes de hacer el pago real que decide el diseño del webhook.
- [Fase 2] MENU-03 (carga inicial de precios reales) bloqueado por precios reales de la carta, pendientes de Jaime.
- [Fase 3] OPS-05/06 (aviso a cocina por Telegram) bloqueado por grupo de Telegram + token del bot, pendientes de Jaime.
- [Fase 4] TRACK-03 (email de cambio de estado) bloqueado por `RESEND_API_KEY` + correo del negocio, pendientes de Jaime.
- [Fase 5] ANLY-01/02 bloqueado por acceso a Meta Business (ID de Pixel) y propiedad de GA4, pendientes de Jaime.
- General: producción cobra plata real hoy — ningún cambio de fase puede dejar el checkout roto durante el despliegue.
- [Fase 2] El plan 02-01 dejó el build roto a propósito ("quedan rotos a nivel de import hasta el plan 02-02, es esperado"). Se revirtió en el quick task 260902-3pr. La premisa queda anulada por el Guardrail 1: cero builds rotos entre tareas.
- [Fase 2] `/api/admin/puntos` y `/api/admin/canjear` no existen. El KDS táctil de `app/admin/page.tsx` que los consume está en cuarentena en `.context/kds-admin-page.tsx.bak` hasta que 02-02 cierre esas rutas.
- La baseline de lint documentada en AGENTS.md ("3 errores react-hooks/set-state-in-effect") está desactualizada: la baseline real medida en 2026-09-04 es 5 problemas (los 3 originales + 2 `no-explicit-any` y 1 `no-unused-vars` en `app/api/admin/pedidos/route.ts`, preexistentes, no introducidos por los quick tasks 260904-*). AGENTS.md debería actualizarse.
- `lib/menu.ts` (carta estatica, ids 1..17, categorias: Combos/Burgers/Pollo/Complementos/Bebidas) y la tabla `menu_items` en vivo (seed `20260901000000_menu_items.sql`, ids 1001+, categorias: Enchiladas/Broaster/Salchipapas-Power Plates/Combos xtremos/Bebidas/Hamburguesas) son DOS taxonomias de categoria que NO se intersectan (excepto "Bebidas"). Cualquier validacion server que compare categoria de item contra `CATEGORIAS_CON_CREMAS` de `lib/menu.ts` debe usar deny-list (`categoriaAdmiteCremas()` en lib/menu.ts, quick task 260904-9po), nunca allow-list directo contra datos en vivo de `getMenuItemLive` — un allow-list rechazaria TODO pedido real con cremas.
- El navegador de claude-in-chrome en esta sesión NO alcanza el `localhost` del sandbox de Bash: son redes distintas. `localhost:3000` en Chrome sirve un proceso Next.js dev que ya corría fuera del sandbox (probablemente lanzado por Jaime/Facundo antes de esta sesión) y que mis `kill`/`npm run dev`/`npm run build && npm run start` dentro del sandbox nunca tocan ni reemplazan. Confirmado 2026-09-04: tras matar y reconstruir el server en el sandbox varias veces, Chrome seguía sirviendo bundles con chunks de HMR/dev viejos (sin `cartLineId`), mientras `curl` dentro del sandbox sí veía el fix. Verificación manual E2E de UI vía claude-in-chrome no es confiable en este entorno — confiar en el gate automatizado (`tsc`/`vitest`/`lint`/`next build`) y, si se necesita UI real, pedirle al usuario que la corra en su propio Conductor/terminal.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260902-3pr | Restaurar build verde tras revisión de código (use client, lib/menu.ts, admin KDS) | 2026-09-02 | 959ae91 | [260902-3pr-restaurar-build-verde-use-client-en-cart](./quick/260902-3pr-restaurar-build-verde-use-client-en-cart/) |
| 260904-7xt | Fix: auto-print marcaba en_preparacion antes de imprimir realmente (race de estado) | 2026-09-04 | c40aa05 | [260904-7xt-fix-auto-print-marca-en-preparacion-ante](./quick/260904-7xt-fix-auto-print-marca-en-preparacion-ante/) |
| 260904-83o | Fix: PATCH de en_preparacion fire-and-forget sin retry, pedido quedaba huerfano en pendiente | 2026-09-04 | d52fcf6 | [260904-83o-fix-patch-de-transicion-a-en-preparacion](./quick/260904-83o-fix-patch-de-transicion-a-en-preparacion/) |
| 260904-8d1 | Fix: repetir item con cremas no reabria selector, segunda unidad heredaba cremas en silencio | 2026-09-04 | eb0c118 | [260904-8d1-fix-en-app-page-tsx-tocar-el-boton-en-un](./quick/260904-8d1-fix-en-app-page-tsx-tocar-el-boton-en-un/) |
| 260904-9lv | Fix: batches de auto-print se acumulaban sin cancelar el anterior; cancel() libera pedidos no impresos para reintento | 2026-09-04 | 861dacf | [260904-9lv-fix-los-settimeout-escalonados-de-auto-p](./quick/260904-9lv-fix-los-settimeout-escalonados-de-auto-p/) |
| 260904-9po | Fix: /api/charge no validaba categoria cremas-eligible ni duplicados; categoriaAdmiteCremas() deny-list (taxonomias de categoria de lib/menu.ts y la tabla menu_items en vivo no se intersectan) | 2026-09-04 | 7d1cca5 | [260904-9po-fix-en-app-api-charge-route-ts-la-valida](./quick/260904-9po-fix-en-app-api-charge-route-ts-la-valida/) |
| 260904-9uy | Fix: buildDeliveryForwardUrl duplicaba buildWhatsAppUrl con templates que divergian; unificado con opts {to, includeGps}, freeze test del mensaje real de cliente | 2026-09-04 | d3d5e3e | [260904-9uy-fix-builddeliveryforwardurl-en-app-admin](./quick/260904-9uy-fix-builddeliveryforwardurl-en-app-admin/) |
| 260904-9yt | Fix: CATEGORIAS_CON_CREMAS era copia manual de CATEGORIES; ahora se deriva por exclusion | 2026-09-04 | eae00ea | [260904-9yt-fix-categorias-con-cremas-en-lib-menu-ts](./quick/260904-9yt-fix-categorias-con-cremas-en-lib-menu-ts/) |

## Deferred Items & Future Backlog

Items acknowledged and carried forward for upcoming iterations:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Admin | Gestor de Promociones en `/admin` (crear, pausar, editar vigencia) | Backlog | 2026-09-02 |
| Fidelización | Backend y canjes de Wolfpoints en mesa/caja (`/puntos` ahora en teaser) | Backlog | 2026-09-02 |
| Hardware | Impresora térmica física ESC/POS (80mm) para comandas en cocina | Backlog | 2026-09-02 |

## Session Continuity

Last session: 2026-09-02T02:42:00.644Z
Stopped at: Phase 2 UI-SPEC approved
Resume file: .planning/phases/02-men-vivo-en-supabase-y-control-de-stock/02-UI-SPEC.md
