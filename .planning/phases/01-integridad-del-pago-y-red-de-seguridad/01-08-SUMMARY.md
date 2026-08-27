---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 08
subsystem: infra
tags: [vercel-cron, culqi, supabase, keep-warm, reconciliacion, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-integridad-del-pago-y-red-de-seguridad
    provides: "lib/alertas.ts (01-03), lib/culqi-verificar.ts y el patron puntero+re-fetch (01-07), __tests__/helpers/supabase-mock.ts (01-01, extendido aqui)"
provides:
  - "vercel.json: declaracion del cron diario (el repo no tenia uno)"
  - "app/api/cron/reconciliacion/route.ts: keep-warm real contra Supabase + reconciliacion de cargos huerfanos en Culqi, en una sola pasada (D-16)"
  - "01-CULQI-FLUJO.md: hallazgo (PARCIAL) sobre el formato real de GET /v2/charges"
  - "__tests__/helpers/supabase-mock.ts extendido: .select().limit() (thenable) y selectEqResultByValue (resultado por valor consultado)"
affects: ["cualquier plan futuro que dependa de que Supabase no se autopause", "fase 3 (OPS), que reusa lib/alertas.ts para el aviso a cocina"]

tech-stack:
  added: []
  patterns:
    - "Cron unico (keep-warm + reconciliacion) en la misma pasada porque Vercel Hobby solo permite una ejecucion diaria (D-16)"
    - "Deteccion sin correccion: el cron alerta ante un cargo huerfano pero nunca escribe en pedidos por su cuenta (D-12)"
    - "Reconciliacion en vez de logica de reintentos: se compara el estado real de Culqi contra Supabase una vez al dia, sin razonar sobre cuanto tiempo lleva un cargo sin pedido (D-10)"

key-files:
  created:
    - vercel.json
    - app/api/cron/reconciliacion/route.ts
    - __tests__/cron-reconciliacion.test.ts
    - .planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-CULQI-FLUJO.md
  modified:
    - .env.example
    - __tests__/helpers/supabase-mock.ts

key-decisions:
  - "El listado de cargos recientes en Culqi (GET /v2/charges) usa SOLO el parametro limit, sin filtro de fecha: no se pudo verificar el formato de un filtro de fecha contra la API real (sin CULQI_SECRET_KEY disponible en este entorno de ejecucion). Documentado en 01-CULQI-FLUJO.md junto con el riesgo aceptado (orden de la lista sin confirmar)."
  - "La reconciliacion corre SOLO si el keep-warm tuvo exito: comparar contra una base que ya se sabe caida no aporta nada. El fallo de Culqi dentro de la reconciliacion nunca anula un keep-warm que ya paso."
  - "El mock compartido de Supabase (__tests__/helpers/supabase-mock.ts) se extendio de forma aditiva (select().limit() thenable + selectEqResultByValue) en vez de crear un mock nuevo para este plan, siguiendo la instruccion explicita de reusar la infraestructura de test de planes anteriores."

patterns-established:
  - "selectEqResultByValue en el mock de Supabase: permite simular resultados distintos por cada valor consultado con .eq() en un mismo test, necesario quando un handler evalua varios ids en un loop (como esta reconciliacion)."

requirements-completed: [INFRA-01, INFRA-02]

duration: ~50min
completed: 2026-08-27
---

# Phase 01 Plan 08: Cron de keep-warm + reconciliacion (INFRA-01/02) Summary

**Cron diario en `vercel.json` que ejecuta una query real contra `pedidos` (no un 200 vacio) para evitar que Supabase se autopause, y en la misma pasada compara los cargos recientes de Culqi contra Supabase para alertar ante cualquier pago confirmado sin pedido — sin crear nada por su cuenta.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 de 4 completadas a nivel de codigo (Task 1, Task 2, Task 3). Task 4 (verificacion en vivo contra Vercel/Supabase) queda pendiente de accion humana, documentada abajo — no bloquea el cierre de este plan ni de la fase.
- **Files modified:** 6 (3 nuevos de produccion/test, 1 doc nuevo, 2 modificados)
- **Tests:** 126/126 en verde (115 preexistentes + 11 nuevos de este plan)

## Accomplishments

- `app/api/cron/reconciliacion/route.ts`: handler `GET` que falla cerrado sin `CRON_SECRET`/con un Bearer incorrecto (mismo patron que `proxy.ts`), ejecuta una query real contra `pedidos` para el keep-warm (INFRA-01), y lista los cargos recientes de Culqi para detectar huerfanos sin pedido (INFRA-02, D-12) — alertando, nunca insertando.
- `vercel.json` (no existia en el repo): declara el cron unico, `0 9 * * *` (09:00 UTC = 04:00 Lima).
- `01-CULQI-FLUJO.md`: documenta el intento (bloqueado por falta de `CULQI_SECRET_KEY` real en este entorno) de verificar el formato de `GET /v2/charges`, y la decision de acotar el alcance al parametro `limit`.
- `__tests__/helpers/supabase-mock.ts` extendido de forma aditiva (no rompe ningun uso de los planes 01-01/03/05/06/07): soporta `.select().limit()` (thenable) y resultados de `.eq()` distintos por valor consultado.
- 126/126 tests en verde, `npx tsc --noEmit` limpio, `npm run build` limpio, `npm run lint` sin errores nuevos (los 3 preexistentes documentados en `deferred-items.md` siguen sin tocar).

## Task Commits

Cada task TDD genero un ciclo RED -> GREEN:

1. **Task 1: gate de `CRON_SECRET` + keep-warm real**
   - RED: `a37fc69` (test, incluye la extension aditiva del mock)
   - GREEN: `8d68fe5` (feat)
2. **Task 2: reconciliacion de cargos huerfanos**
   - RED: `f3d13d1` (test, incluye `01-CULQI-FLUJO.md`)
   - GREEN: `a1718aa` (feat)
3. **Task 3: `vercel.json`**
   - `ac2b86c` (feat)

**Task 4 (checkpoint:human-verify, gate="blocking-human"):** NO ejecutada — requiere cargar `CRON_SECRET` en Vercel, un despliegue deliberado a produccion y acceso al dashboard de Supabase. Ver "Verificaciones manuales pendientes".

**Plan metadata:** este commit (`docs(01-08): ...`, generado al cerrar el plan).

## Files Created/Modified

- `app/api/cron/reconciliacion/route.ts` - Gate de autorizacion, keep-warm real, listado + reconciliacion de cargos huerfanos
- `vercel.json` - Declaracion del cron unico (nuevo archivo, el repo no tenia uno)
- `__tests__/cron-reconciliacion.test.ts` - 11 tests: gate (3), keep-warm (3), reconciliacion (5)
- `__tests__/helpers/supabase-mock.ts` - Extension aditiva: `.select().limit()` thenable, `selectEqResultByValue`
- `.env.example` - Documenta `CRON_SECRET`
- `.planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-CULQI-FLUJO.md` - Hallazgo (PARCIAL) sobre `GET /v2/charges`

## Decisions Made

Ver `key-decisions` en el frontmatter. Ademas:

- El mensaje de alerta de un cargo huerfano incluye `culqi_charge_id` y monto (nunca la `CULQI_SECRET_KEY` ni el `CRON_SECRET`), consistente con T-01-46/T-01-48 del threat register del plan.
- La respuesta HTTP del cron es un resumen minimo (`{ ok: boolean }`), sin exponer cuantos pedidos hay ni datos de clientes (T-01-48).
- Idempotencia dentro de una misma pasada: un `Set` de ids vistos evita alertar dos veces por el mismo cargo si Culqi devuelve un id repetido en el listado (caso 10 del plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree en una historia de git distinta a la base esperada**
- **Found during:** Arranque de la ejecucion, `worktree_branch_check`
- **Issue:** El worktree tenia HEAD en un commit (`8d6d0ef`, plan 01-02) que no era ancestro de la base esperada `6bf1b28` (post-wave-5). Faltaban las waves 1-5 completas (alertas, validacion, rate limit, webhook definitivo).
- **Fix:** `git reset --hard 6bf1b28`, siguiendo el protocolo explicito de `worktree_branch_check` del prompt de ejecucion.
- **Files modified:** ninguno (reset a un commit ya existente en el remoto/base)
- **Verification:** `git log --oneline -5` confirmo la historia correcta antes de tocar ningun archivo
- **Committed in:** N/A (operacion de git, no un commit de codigo)

**2. [Rule 3 - Blocking] `node_modules` no estaba instalado**
- **Found during:** Inicio de la Task 1
- **Issue:** Mismo caso documentado en planes anteriores (01-02, 01-03, 01-07): el worktree no tenia dependencias instaladas.
- **Fix:** `npm install` sin flags, usando el `package-lock.json` existente. Se descarto el churn del lockfile con `git checkout -- package-lock.json` antes de cada commit (sin cambios reales en `package.json`).
- **Files modified:** ninguno versionado
- **Verification:** `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` corrieron correctamente; `git diff --stat -- package-lock.json` vacio en cada commit
- **Committed in:** N/A

---

**Total deviations:** 2 auto-fixed (ambos Rule 3, bloqueantes de arranque). Ninguno afecta el alcance del plan ni introduce funcionalidad no pedida.

## Issues Encountered

- **Bloqueo externo real (no un deviation, un limite del entorno):** el plan pedia resolver el formato de `GET /v2/charges` "con una llamada real de un segundo usando la secret key". Este entorno de ejecucion no tiene `.env.local` ni `CULQI_SECRET_KEY` real (solo Jaime/el panel de Culqi la tienen). Se confirmo que hay conectividad de red real (`curl` a `api.culqi.com` responde), pero con una llave invalida Culqi rechaza la peticion por autenticacion ANTES de validar cualquier parametro de query — no hay forma de inferir el formato de filtro de fecha sin una llave real. Documentado en detalle en `01-CULQI-FLUJO.md`, con la decision tomada (usar solo `limit`) y el riesgo aceptado (orden del listado sin confirmar). Esto es la misma categoria de bloqueo que PAY-01 (cuenta Culqi) y el bot de Telegram de PAY-05: requiere un humano con las credenciales reales.
- `npm run lint` reporta los mismos 3 errores preexistentes (`react-hooks/set-state-in-effect`) ya documentados en `deferred-items.md`. Ninguno de esos archivos fue tocado por este plan.

## Verificaciones manuales pendientes

Ninguno de estos pasos es automatizable por este agente: implican credenciales de produccion, un despliegue deliberado, y acceso a paneles externos (Vercel, Supabase, CulqiPanel) con sesion humana.

### 1. Cargar `CRON_SECRET` y desplegar (Task 4 del plan, checkpoint bloqueante)

**ORDEN OBLIGATORIO — cargar el secreto ANTES de desplegar.** Si se despliega sin `CRON_SECRET`, el handler devuelve 401 a todo (incluido a Vercel) y el cron parece registrado pero nunca hace nada. Falla cerrado, pero silencioso.

1. Generar un secreto: `openssl rand -hex 32`
2. Cargarlo como `CRON_SECRET` en Vercel -> Settings -> Environment Variables, entorno de produccion
3. Mergear/desplegar esta rama a produccion (el codigo de este plan y de los planes 01-03 a 01-07 vive en esta rama; `loboburger.com` hoy sirve `main` en `e98eb15` mas el endpoint temporal de captura de 01-02, ver `01-07-SUMMARY.md`)
4. Confirmar en Vercel -> Settings -> Cron Jobs que el cron aparece con el path `/api/cron/reconciliacion` y el schedule `0 9 * * *`
5. Dispararlo manualmente desde el dashboard ("Run")
6. Ver los logs de esa ejecucion: confirmar status 200
7. **La verificacion que importa (pitfall 13):** entrar al dashboard de Supabase y confirmar que la actividad del proyecto registra la query. Un 200 en Vercel no prueba que la base se toco
8. Probar el gate desde afuera: `curl https://loboburger.com/api/cron/reconciliacion` sin header debe devolver 401. Con un Bearer inventado, tambien 401
9. Probar la rama de alerta: si hay algun cargo huerfano real, confirmar que llego el mensaje a Telegram (requiere que Jaime ya haya entregado `TELEGRAM_ALERT_BOT_TOKEN`/`TELEGRAM_ALERT_CHAT_ID`, ver `01-03-SUMMARY.md` — sin eso, la alerta degrada a `console.error` en los logs de Vercel, visible igual pero no en un celular)
10. **Anotar la fecha de re-chequeo:** volver a mirar en 7 dias (objetivo: **2026-09-03**) que el proyecto de Supabase no se autopauso desde el despliegue

### 2. Confirmar el formato real de `GET /v2/charges` (ver `01-CULQI-FLUJO.md`)

Con una `CULQI_SECRET_KEY` real y conectividad, hacer una llamada de un segundo para confirmar:
- El orden del listado (recientes primero o al reves) — determina si `limit=20` cubre el dia actual o trae cargos viejos
- Si acepta algun filtro de fecha, y su formato exacto
- La forma exacta de la respuesta (`{data: [...]}` vs. array plano)

Actualizar `listarCargosRecientes()` en `app/api/cron/reconciliacion/route.ts` y `01-CULQI-FLUJO.md` con lo que se confirme.

### 3. Pendientes heredados de planes anteriores, no de este plan

- **PAY-01** (verificacion de la cuenta test de Culqi, `DNGA9999`) sigue bloqueado externamente por Culqi/Jaime (ver `STATE.md` Blockers). Sin resolver esto, la Task 4 de `01-07-PLAN.md` (pago real que confirma el payload del webhook) tampoco se pudo ejecutar, y por lo tanto tampoco esta Task 4 de `01-08` puede probar la rama de alerta contra un cargo real.
- **PAY-05** (bot de Telegram/grupo de alertas) sigue bloqueado por credenciales pendientes de Jaime (ver `01-03-SUMMARY.md`). El canal de alertas funciona (degradado a `console.error`) sin ellas, pero nadie ve un mensaje en un celular hasta que se entreguen.
- Las migraciones `20260820000000_pedidos.sql` y `20260825000000_rate_limit.sql` siguen sin aplicarse en produccion (Supabase free tier autopausado, timeouts — el mismo problema que INFRA-01 mitiga). Este plan no agrego ninguna migracion nueva; el cron depende de que la tabla `pedidos` ya exista cuando se despliegue.
- El endpoint definitivo del webhook (plan 01-07) tampoco esta desplegado en produccion todavia (ver `01-07-SUMMARY.md`, seccion "Desplegar el handler definitivo").

## Cierre de Fase 1

Este es el ultimo plan de la Fase 1 (integridad-del-pago-y-red-de-seguridad). Estado de las 14 requirements de la fase, a nivel de codigo (no de verificacion en vivo):

| Requirement | Estado a nivel de codigo | Bloqueo pendiente |
|---|---|---|
| PAY-01 | Codigo tolera ambos prefijos (`chr_`/`ord_`) sin adivinar | Verificacion con cuenta Culqi real, pendiente de Culqi/Jaime |
| PAY-02/03/04 | Webhook definitivo implementado y testeado (01-07) | Pago real + deploy deliberado, Task 4 de 01-07 |
| PAY-05 | `alertaTelegram()` implementado y cableado (01-03) | Bot/grupo de Telegram, pendiente de Jaime |
| PAY-06 | Rate limit por IP cableado en `/api/charge` (01-06) | Ninguno — completo |
| PAY-07 | Validacion de email/telefono server-side (01-05) | Ninguno — completo |
| INFRA-01 | Keep-warm real implementado y testeado (este plan) | Verificacion en vivo contra el dashboard de Supabase (Task 4) |
| INFRA-02 | Reconciliacion implementada y testeada (este plan) | Verificacion en vivo + formato real de `GET /v2/charges` |
| INFRA-03 | Instrumentacion de Sentry (01-03) | Cuenta de Sentry, pendiente de Jaime (opcional) |
| INFRA-04 | Suite de tests + caracterizacion (01-01) | Ninguno — completo, 126 tests en verde |
| CLEAN-02/03/04 | Ver planes 01-04/01-05 | Ver sus respectivos SUMMARY |

**Ningun cambio de este plan (ni de la fase) esta desplegado en produccion todavia.** `loboburger.com` sigue sirviendo `main`@`e98eb15` + el endpoint temporal de captura de 01-02. El despliegue deliberado de toda la fase, con todos los checkpoints de verificacion en vivo pendientes resueltos en orden, queda como el proximo paso critico antes de poder considerar la Fase 1 verificada end-to-end.

## Next Phase Readiness

- Codigo completo y cubierto por tests para INFRA-01 e INFRA-02. La ruta esta lista para desplegarse; falta la verificacion en vivo (Task 4) y el despliegue deliberado a produccion.
- `__tests__/helpers/supabase-mock.ts` extendido queda disponible para cualquier plan futuro que necesite simular resultados distintos por valor consultado en `.eq()`, o queries de tipo `.limit()`.
- Bloqueante real pendiente, fuera del alcance de este agente: el despliegue deliberado de toda la Fase 1 a produccion, con `CRON_SECRET` cargado ANTES del deploy.

## Self-Check: PASSED

- FOUND: `vercel.json`
- FOUND: `app/api/cron/reconciliacion/route.ts`
- FOUND: `__tests__/cron-reconciliacion.test.ts`
- FOUND: `.planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-CULQI-FLUJO.md`
- FOUND: commits `a37fc69`, `8d68fe5`, `f3d13d1`, `a1718aa`, `ac2b86c` en `git log --oneline`
- 126/126 tests en verde, `npx tsc --noEmit` limpio, `npm run build` limpio

---
*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Completed: 2026-08-27*
