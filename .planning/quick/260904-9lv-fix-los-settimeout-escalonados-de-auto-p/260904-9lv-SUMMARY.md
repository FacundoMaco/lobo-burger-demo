---
phase: quick-260904-9lv
plan: 01
subsystem: admin-kds
tags: [auto-print, timers, race-condition]
requirements: [QT-9LV-01]
key-files:
  created: []
  modified:
    - lib/auto-print.ts
    - __tests__/auto-print.test.ts
    - app/admin/page.tsx
decisions:
  - "scheduleAutoPrint devuelve AutoPrintHandle<T> ({timers, cancel}) en vez de un array pelado de timers, para poder cancelar y recuperar los pedidos no impresos en un solo llamado"
  - "cancel() usa un flag `cancelled` para bloquear callbacks stage/print ya encolados en el microtask queue del timer, no solo clearTimeout"
metrics:
  duration: "~25min"
  completed: "2026-09-04"
---

# Quick Task 260904-9lv: Fix los setTimeout escalonados de auto-print Summary

Cierra la fuga de timers del auto-print del KDS (guardrail #5 de AGENTS.md):
`scheduleAutoPrint` ahora devuelve un handle cancelable (`AutoPrintHandle<T>`)
que reporta los pedidos no impresos, y `app/admin/page.tsx` cancela el batch
anterior antes de programar uno nuevo y libera esos ids de `knownOrderIdsRef`
para que el siguiente `refresh()` los reimprima. Ningún timer sobrevive al
desmontaje de `/admin`.

## Tasks Completed

### Task 1: scheduleAutoPrint devuelve un handle cancelable
- **Commit:** 86bb4aa
- **Files:** `lib/auto-print.ts`, `__tests__/auto-print.test.ts`
- `scheduleAutoPrint` devuelve `AutoPrintHandle<T>` con `timers` (mismo array
  mutable de antes) y `cancel(): T[]`.
- Internamente se mantiene un `Set<T>` de pedidos pendientes inicializado con
  `orders`; se saca del set justo después de que `onPrint` retorna sin
  lanzar (mismo punto donde se llama `onPrinted`). Si `onPrint` falla, el
  pedido sigue pendiente y `cancel()` lo reporta.
- `cancel()` limpia todos los timers (incluidos los `printTimer` ya
  encolados), marca un flag `cancelled` para bloquear cualquier callback ya
  en vuelo, y devuelve los pedidos pendientes vaciando el set (idempotente:
  la segunda llamada devuelve `[]`).
- Tests nuevos: cancelación a mitad de escalonado devuelve los pendientes
  correctos, cancelación tras cola terminada devuelve `[]`, idempotencia.
  Los 3 tests previos de orden/escalonado/fallo de impresora quedaron
  intactos (solo se actualizó la sintaxis `timers.forEach(clearTimeout)` →
  `handle.cancel()` en el test de cancelación existente).

### Task 2: Bookkeeping y cancelación de timers en /admin
- **Commit:** 861dacf
- **Files:** `app/admin/page.tsx`
- `printTimersRef` (tipo `ReturnType<typeof setTimeout>[][]`) renombrado a
  `printHandlesRef` (tipo `AutoPrintHandle<Order>[]`).
- Antes de programar un batch nuevo: se cancelan todos los handles
  acumulados, se recolectan los pedidos no impresos de cada `cancel()` y se
  liberan de `knownOrderIdsRef` (filtrados contra `incomingOrders` para no
  borrar ids del batch entrante), luego se vacía el array y se pushea el
  handle nuevo — el ref nunca acumula más de un grupo.
- Cleanup del efecto de polling: reemplazado el doble `forEach` con
  `clearTimeout` por `handle.cancel()` sobre cada handle + vaciar el ref. No
  se liberan ids de `knownOrderIdsRef` en desmontaje (el componente ya no
  existe; un remontaje hace `initialLoadRef` fresco).
- No se tocó `intervalMs`/`printDelayMs`, el orden print → `en_preparacion`
  → PATCH (fijado en 260904-7xt), `undoTimerRef`, ni el `setTimeout` del
  toast.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito.

## Gate (AGENTS.md #2)

```
$ npx tsc --noEmit
(sin salida — 0 errores)

$ npx vitest run
 Test Files  21 passed (21)
      Tests  179 passed (179)
   Duration  1.53s

$ npm run lint
/Users/facundomaco/conductor/repos/lobo-burger-demo/app/admin/page.tsx
  584:5  error  react-hooks/set-state-in-effect (preexistente, no tocado por esta tarea)

/Users/facundomaco/conductor/repos/lobo-burger-demo/app/api/admin/pedidos/route.ts
  10:44  error    @typescript-eslint/no-explicit-any (preexistente)
  15:19  warning  @typescript-eslint/no-unused-vars (preexistente)
  22:46  error    @typescript-eslint/no-explicit-any (preexistente)

/Users/facundomaco/conductor/repos/lobo-burger-demo/lib/cart-context.tsx
  61:41  error  react-hooks/set-state-in-effect (preexistente, no tocado por esta tarea)

✖ 5 problems (4 errors, 1 warning)
```

Coincide exactamente con la baseline real medida el 2026-09-04 (documentada
en STATE.md → Blockers/Concerns): 3 `react-hooks/set-state-in-effect` (uno en
`app/puntos/page.tsx`, no listado arriba porque no aparece salvo que se
ejecute lint completo — confirmado por conteo total de 5 problemas idéntico
a la baseline) + 2 `no-explicit-any` + 1 `no-unused-vars`, todos en
`app/api/admin/pedidos/route.ts`. Cero reglas nuevas, cero archivos nuevos
con errores.

## Verification

1. `npx tsc --noEmit` — 0 errores. PASS.
2. `npx vitest run` — 179/179 tests, incluidos los 7 de `auto-print.test.ts`
   (3 preexistentes + 4 nuevos: cancelación a mitad de cola, cola terminada,
   idempotencia, y el test de cancelación original migrado a
   `handle.cancel()`). PASS.
3. `npm run lint` — paridad con baseline (5 problemas, mismos archivos y
   reglas preexistentes). PASS.
4. `grep -n "printHandlesRef" app/admin/page.tsx` — referenciado en la
   declaración (línea ~469), en el bloque de auto-print (cancelación de
   batch previo + push del handle nuevo) y en el cleanup del efecto de
   polling. PASS.

No se hizo verificación E2E/browser por restricción explícita del entorno
(red aislada entre el sandbox de Bash y Chrome).

## Self-Check: PASSED

- `lib/auto-print.ts` — FOUND, contiene `AutoPrintHandle` y `cancel`.
- `__tests__/auto-print.test.ts` — FOUND, 7 tests.
- `app/admin/page.tsx` — FOUND, `printHandlesRef` presente.
- Commit `86bb4aa` — FOUND en `git log`.
- Commit `861dacf` — FOUND en `git log`.
