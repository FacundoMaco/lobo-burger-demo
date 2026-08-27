---
phase: 01-integridad-del-pago-y-red-de-seguridad
plan: 04
subsystem: higiene-panel-y-docs
tags: [tdd, localStorage, admin, deploy-docs]
dependency-graph:
  requires: ["01-01"]
  provides:
    - "construirOrderLocal(order) en lib/orders-store.ts — reemplazo de saveOrder, misma forma, sin persistencia"
    - "app/admin/page.tsx sin botones de pedido de prueba ni escrituras muertas"
  affects:
    - "lib/cart-context.tsx (import y llamada actualizados, lobo_cart intacto)"
    - "app/checkout/page.tsx (NO tocado — diff cero verificado)"
tech-stack:
  added: []
  patterns:
    - "Caracterizacion antes de refactor (D-25), esta vez con ciclo RED->GREEN clasico (no invertido como en 01-01): Paso 1 caracteriza el comportamiento actual en verde, Paso 2 lo endurece exigiendo la ausencia de localStorage y falla real (RED), Paso 3 implementa (GREEN)"
key-files:
  created:
    - __tests__/orders-store.test.ts
  modified:
    - lib/orders-store.ts
    - lib/cart-context.tsx
    - app/admin/page.tsx
decisions:
  - "Nombre elegido para el reemplazo de saveOrder: construirOrderLocal. Los planes de Fase 3/4 que toquen el objeto de confirmacion o el respaldo de WhatsApp deben importar este nombre, no saveOrder (eliminado)."
metrics:
  duration: "~1h"
  completed: 2026-08-26
---

# Phase 1 Plan 04: Higiene de orders-store, panel admin y DEPLOY.md Summary

`lib/orders-store.ts` deja de escribir una copia muerta de cada pedido real en
`localStorage`, el panel `/admin` pierde sus dos botones de pedido de prueba
y la llamada que fingia marcar "entregado", y `.context/DEPLOY.md` se
actualizo al estado real del sistema (con la salvedad documentada abajo
sobre por que ese archivo no pudo commitearse).

## Lo que se construyo

**Task 1 (CLEAN-02) — RED/GREEN con caracterizacion previa.**
`__tests__/orders-store.test.ts` primero caracterizo el `saveOrder` y
`buildWhatsAppUrl` actuales en verde (5/5, gate de caracterizacion D-25),
despues se reescribio para exigir que la construccion del objeto de
confirmacion NO llame a `localStorage.setItem` (RED real, 7/7 fallando por
`construirOrderLocal is not a function`), y recien ahi se implemento
`lib/orders-store.ts`: `saveOrder` -> `construirOrderLocal`, misma firma y
mismo valor de retorno, sin la linea de persistencia. Se eliminaron
`getOrders` (quedaba muerto sin la escritura) y `updateOrderStatus` (unico
llamador eliminado en Task 2). `lib/cart-context.tsx` actualiza el import y
la llamada en `submitOrder`; `lobo_cart` (la clave real del carrito) no se
toco. `app/checkout/page.tsx` queda con diff cero, verificado con
`git diff --exit-code`.

**Task 2 (CLEAN-03).** En `app/admin/page.tsx`: eliminados `MOCK_NAMES`,
`MOCK_ITEMS`, `generateMockOrder()`, los imports muertos
(`updateOrderStatus`, `saveOrder`), los dos botones "Agregar pedido de
prueba", y la llamada a `updateOrderStatus` dentro de `handleAddPoints` (el
campo `orderId` y su `useState` se mantuvieron, siguen en uso). Se corrigio
ademas el texto falso del estado vacio ("Los pedidos enviados por WhatsApp
aparecen aqui" -> "Los pedidos pagados en la web aparecen aqui"). `refresh()`,
`handleStatus()` y el camino contra `/api/admin/pedidos` quedaron intactos.

**Task 3 (CLEAN-04) — bloqueado por configuracion de git preexistente, ver
Deviations.** Se redacto el contenido actualizado completo de
`.context/DEPLOY.md` (env vars completas con "que pasa si falta" cada una,
seccion de pedidos con el estado real en Supabase, aviso de fecha sobre la
nota de Culqi con referencia a PAY-01/01-02, nota de la Fase 1), pero el
archivo no pudo commitearse: ver deviacion abajo.

## Deviations from Plan

### Auto-fixed Issues

Ninguna en Task 1/2 — ambas se ejecutaron tal cual el plan, sin bugs
preexistentes descubiertos en el camino.

### Bloqueante documentado (Task 3, CLEAN-04)

**[Hallazgo de configuracion — no es un bug de codigo] `.context/` esta
excluido de git en este repo, `.context/DEPLOY.md` no puede commitearse.**

- **Encontrado en:** Task 3, al intentar `git add .context/DEPLOY.md`.
- **Evidencia:** `.git/info/exclude` (linea 7) contiene `.context/`. El
  comando devuelve: `The following paths are ignored by one of your
  .gitignore files: .context — hint: Use -f if you really want to add
  them.` El archivo tampoco existia en este worktree antes de esta tarea
  (es contenido no versionado, propio de cada checkout local — confirmado
  con `git log --all -- .context/DEPLOY.md`, sin resultados).
- **Que se hizo:** se escribio el contenido actualizado completo en
  `.context/DEPLOY.md` dentro de este worktree (verificado contra los
  criterios de aceptacion del plan: menciona `pedidos`, `SUPABASE_SERVICE_ROLE_KEY`,
  `TELEGRAM_ALERT_BOT_TOKEN`, `SENTRY_DSN`; cero coincidencias de
  `sk_(live|test)_[A-Za-z0-9]{8}`; el item 4 del checklist ya no describe
  localStorage como limitacion vigente; la nota de Culqi lleva aviso de
  fecha y referencia a PAY-01/01-02). **No se forzo el `git add -f`**:
  hacerlo violaria la configuracion explicita del repo (`.git/info/exclude`
  es una decision deliberada, no un descuido), y el contrato de este
  executor prohibe forzar operaciones de git fuera de lo pedido.
- **Por que no se resolvio solo:** esto no es un bug del codigo de la
  aplicacion ni bloquea CLEAN-02/CLEAN-03 (Task 1/2 son independientes de
  esto y ya estan commiteadas). Es una decision de si `.context/` deberia
  ser parte del historial de git de este repo, que le corresponde al dueno
  del repo, no a este plan.
- **Impacto:** el archivo con el contenido correcto existe en este
  worktree pero se pierde cuando el orquestador elimine el worktree
  despues de este reporte. **CLEAN-04 queda sin cerrar en git.**
- **Alternativas para quien retome esto:**
  1. Sacar `.context/` de `.git/info/exclude` y trackearlo (si la intencion
     original era que sea documentacion versionada).
  2. Migrar el contenido de `DEPLOY.md` a `.planning/codebase/` (donde ya
     viven `ARCHITECTURE.md`, `CONCERNS.md`, `STACK.md`, etc. — todos SI
     trackeados), que parece ser el reemplazo natural de `.context/` en
     este proyecto.
  3. Dejarlo como esta si `.context/` es intencionalmente notas locales
     por-checkout y CLEAN-04 se considera satisfecho por existir en al
     menos un checkout (los-angeles) aunque desactualizado ahi.
- **Recomendacion:** opcion 2 — el patron `.planning/codebase/*.md` ya
  existe, ya esta versionado, y evita que esta clase de deriva ("el doc
  describe un sistema de hace dos meses") se repita.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno. Este plan no agrega superficie nueva (borra codigo y actualiza
documentacion); ver el registro STRIDE del plan (T-01-16 a T-01-20), todos
con disposition `mitigate` y cubiertos por las verificaciones de abajo.

## Verification

- `npm run test:run`: 35/35 en verde (28 preexistentes de 01-01 + 7 nuevos
  de `orders-store.test.ts`)
- `npx tsc --noEmit`: sin errores
- `npm run lint`: mismos 3 errores preexistentes de
  `react-hooks/set-state-in-effect` documentados en `deferred-items.md`
  (`app/admin/page.tsx`, `app/puntos/page.tsx`, `lib/cart-context.tsx`),
  ninguno nuevo, ninguno de imports/variables sin usar
- `npm run build`: termina sin errores
- `git diff --exit-code -- app/checkout/page.tsx`: exit code 0, diff cero
- `grep -c 'lobo_cart' lib/cart-context.tsx`: 1 (igual que antes del cambio)
- Todos los greps de aceptacion de Task 1 y Task 2 verificados manualmente
  (ver detalle en el cuerpo del reporte de ejecucion) — con una unica
  discrepancia de conteo esperada: `grep -c 'export type Order'
  lib/orders-store.ts` devuelve 2 en vez de 1 porque `OrderStatus` tambien
  matchea el patron como substring; esto ya pasaba en el archivo original
  antes de cualquier cambio de este plan (ambos tipos siempre convivieron
  ahi), no es una regresion.

## Commits

- `585da6e` — test(01-04): caracterizar saveOrder y buildWhatsAppUrl en verde (D-25)
- `144c2b8` — feat(01-04): quitar persistencia muerta en localStorage de orders-store
- `27085f6` — fix(01-04): eliminar botones de pedido de prueba y escritura muerta en admin

## TDD Gate Compliance

Task 1 (`type="tdd"`) cumple la secuencia completa: `test(01-04): ...`
(RED-ish caracterizacion + RED real, un solo commit porque el archivo de
test se edito dos veces antes del primer commit permanente — el gate de
caracterizacion en verde y el RED real se verificaron localmente con
`npm run test:run` en cada paso pero solo se commiteo el estado final del
test junto con el commit `feat` subsiguiente que lo pone en GREEN) seguido de
`feat(01-04): ...` (GREEN). No hubo REFACTOR adicional.

## Next Steps

`construirOrderLocal` es el nombre a usar en cualquier plan futuro (Fase 3/4)
que necesite el objeto de confirmacion local o el respaldo de WhatsApp;
`saveOrder` ya no existe. CLEAN-04 (`.context/DEPLOY.md`) requiere una
decision de configuracion de git antes de poder cerrarse formalmente — ver
la seccion de deviations arriba.

## Self-Check: PASSED

- `lib/orders-store.ts` — FOUND, contiene `construirOrderLocal`, sin
  `localStorage`/`lobo_orders`/`saveOrder`/`getOrders`
- `lib/cart-context.tsx` — FOUND, importa y llama `construirOrderLocal`
- `app/admin/page.tsx` — FOUND, sin `generateMockOrder`/`MOCK_NAMES`/`MOCK_ITEMS`/`updateOrderStatus`/`saveOrder`
- `__tests__/orders-store.test.ts` — FOUND, 7 tests
- Commits `585da6e`, `144c2b8`, `27085f6` — verificados con `git log --oneline`, presentes en `worktree-agent-a579c449eff91e3ad`
- `.context/DEPLOY.md` — existe en este worktree con el contenido
  actualizado, pero NO esta commiteado (ver deviation) — MISSING del
  historial de git, presente solo en el filesystem de este worktree
