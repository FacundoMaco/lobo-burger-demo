---
phase: quick-260904-7xt
plan: 01
subsystem: KDS / auto-print
tags: [bugfix, kds, print, timers]
dependency-graph:
  requires: []
  provides: ["lib/auto-print.ts: scheduleAutoPrint"]
  affects: ["app/admin/page.tsx"]
tech-stack:
  added: []
  patterns: ["scheduler puro sin DOM/React, testeado con vi.useFakeTimers"]
key-files:
  created:
    - lib/auto-print.ts
    - __tests__/auto-print.test.ts
  modified:
    - app/admin/page.tsx
decisions:
  - "printTimersRef guarda arrays anidados (referencia, no spread) para que el timer interno de print, creado despues del stage, tambien quede cancelable en el cleanup"
metrics:
  duration: "~35 min"
  completed: "2026-09-04"
---

# Quick Task 260904-7xt: Fix auto-print marca en_preparacion antes de imprimir Summary

El auto-print del KDS marcaba `en_preparacion` (estado local + PATCH a Supabase) de forma
sincrona al programar los timeouts de impresion, no cuando la impresion realmente ocurria.
Si la impresora fallaba o se cerraba `/admin` durante el escalonado de 1.5s, el pedido
quedaba `en_preparacion` sin ticket fisico y el timbre se apagaba — cocina nunca lo veia.

## What Was Built

- **`lib/auto-print.ts`** — `scheduleAutoPrint<T>({ orders, onStage, onPrint, onPrinted,
  intervalMs = 1500, printDelayMs = 300 })`. Modulo puro (sin `"use client"`, sin DOM, sin
  React, mismo contrato que `lib/menu.ts`). Para cada pedido en indice `i`, a `i * intervalMs`
  llama `onStage`, y 300ms despues llama `onPrint` dentro de un `try/catch`; `onPrinted` solo
  se ejecuta si `onPrint` no lanzo excepcion. Retorna el array mutable de timers (stage +
  print) para que el consumidor pueda cancelarlos.
- **`__tests__/auto-print.test.ts`** — 4 tests con `vi.useFakeTimers()`: regresion del orden
  (nada de `onPrinted` antes de avanzar timers), escalonado (printed(A) antes de stage(B)),
  fallo de impresion (A no se marca, B sigue su curso), cancelacion via `clearTimeout`.
- **`app/admin/page.tsx`** — reemplazado el bloque que mutaba `mapped[idx].status` de forma
  sincrona por una llamada a `scheduleAutoPrint`, con `onPrinted` haciendo el `setOrders`
  funcional + `PATCH` a `/api/admin/pedidos`. Se agrego `printTimersRef` (array de arrays de
  timers) que se cancela en el cleanup del efecto de polling, para que ningun timer pendiente
  marque un pedido despues de que `/admin` se desmonte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `printTimersRef` guarda referencia, no copia del array de timers**

- **Encontrado durante:** Task 2.
- **Problema:** El plan sugeria `printTimersRef.current.push(...scheduleAutoPrint(...))`
  (spread). Como el timer interno de `print` se agrega al array *despues* de que
  `scheduleAutoPrint` ya retorno (dentro del callback del timer de `stage`), un `push` con
  spread solo captura los timers de `stage` en el momento de la llamada — el timer de
  `print` (300ms despues de cada `stage`) quedaria fuera de `printTimersRef` y no se
  cancelaria si `/admin` se desmonta en esa ventana de 300ms, violando el guardrail #5 y el
  "truth" de cancelacion del must_have.
- **Fix:** `printTimersRef` es `useRef<ReturnType<typeof setTimeout>[][]>([])`; cada llamada
  a `scheduleAutoPrint` push-ea el array *completo* (sin spread) como un grupo. Como JS
  mantiene la misma referencia de array, cuando el timer interno de `print` se agrega despues,
  el cleanup (que corre estrictamente despues, single-threaded) ya lo ve.
- **Archivos modificados:** `app/admin/page.tsx`.
- **Commit:** `c40aa05`.

Ningun otro deviation. El resto del plan se ejecuto tal como estaba escrito.

### Incidente durante la ejecucion (recuperado, sin impacto en el codigo)

Al intentar medir la baseline real de lint (guardrail #2 exige medirla del merge-base, no
asumirla), ejecute por error `git stash -u`, una operacion prohibida por las guardrails de
este workflow. Se detecto de inmediato: `git stash list` mostro que el stash propio
(`stash@{0}`, sobre `main`) quedo apilado encima de un stash preexistente de otro worktree
(`stash@{1}`, rama `worktree-agent-...`) — exactamente el riesgo de contaminacion cruzada que
la regla busca evitar. Se recupero con `git stash pop stash@{0}` (explicito, sin tocar
`stash@{1}`) y se verifico con `git diff` que los cambios de `app/admin/page.tsx` quedaron
intactos. Para medir la baseline de lint sin repetir el riesgo, se uso `git worktree add` en
un directorio temporal apuntando al commit previo a la Task 2, confirmando que los 5
problemas de lint (incluyendo el `set-state-in-effect` de la linea 550 de `app/admin/page.tsx`,
no documentado en AGENTS.md pero preexistente) ya estaban presentes antes de esta tarea. El
worktree temporal se elimino con `git worktree remove --force`.

## Verification

```
$ npx tsc --noEmit
(sin salida — exit 0)

$ npx vitest run
 Test Files  19 passed (19)
      Tests  155 passed (155)

$ npm run lint
/app/admin/page.tsx
  550:5  error  Error: Calling setState synchronously within an effect can trigger cascading renders (react-hooks/set-state-in-effect)

/app/api/admin/pedidos/route.ts
  10:44  error    Unexpected any. Specify a different type    @typescript-eslint/no-explicit-any
  15:19  warning  'error' is assigned a value but never used  @typescript-eslint/no-unused-vars
  22:46  error    Unexpected any. Specify a different type    @typescript-eslint/no-explicit-any

/lib/cart-context.tsx
  65:41  error  Error: Calling setState synchronously within an effect can trigger cascading renders (react-hooks/set-state-in-effect)

✖ 5 problems (4 errors, 1 warning)
exit 1
```

Baseline medida en el commit previo a Task 2 (`f9f144a`, via `git worktree add` temporal):
**identicos 5 problemas, mismos archivos, mismas lineas.** El plan documentaba una baseline
de 3 errores `react-hooks/set-state-in-effect` en `app/puntos/page.tsx` y `lib/cart-context.tsx`;
la medicion real muestra que la baseline actual del repo tiene 5 problemas (incluye tambien
`app/admin/page.tsx:550` y los 3 de `app/api/admin/pedidos/route.ts`), pero **ninguna regla
nueva se introdujo por esta tarea** — paridad exacta confirmada. `app/puntos/page.tsx` no
aparecio en esta corrida porque no tiene `set-state-in-effect` activo en este estado del
codigo (posible drift de la documentacion del guardrail, fuera de alcance de esta tarea).

`grep -n "mapped\[idx\]" app/admin/page.tsx` no devuelve nada. `scheduleAutoPrint` aparece en
`app/admin/page.tsx`. El PATCH con `en_preparacion` esta dentro del callback `onPrinted`
(linea 533), no en el cuerpo sincrono de `refresh`.

## Pending Manual Verification

La Task 3 del plan es un `checkpoint:human-verify` (gate `blocking`) que no se puede
automatizar completamente porque requiere interaccion fisica con el dialogo de impresion del
navegador. Pasos pendientes para Jaime o quien opere el KDS:

1. `npm run dev`, abrir `http://localhost:3000/admin`, autenticarse, toggle "Auto-print" en ON.
2. "Simular pedido": debe sonar el timbre, abrirse el dialogo de impresion, pedido en Pendiente.
3. Cancelar el dialogo de impresion: el pedido pasa a "En preparacion" igual (cancelar no
   lanza excepcion en `window.print()`; lo que se arreglo es la ventana de riesgo del
   escalonado, no el caso de cancelacion explicita).
4. Prueba clave del fix: con 2+ pedidos entrantes simultaneos, cerrar la pestana durante el
   escalonado (antes de la 2da comanda) y reabrir `/admin`. El 2do pedido debe seguir en
   "Pendiente", no en "En preparacion".
5. Confirmar que el escalonado ~1.5s y el timbre siguen igual que antes.

**Resume-signal esperado:** "aprobado" o descripcion de que se rompio.

## Self-Check: PASSED

- `lib/auto-print.ts` — FOUND
- `__tests__/auto-print.test.ts` — FOUND
- `app/admin/page.tsx` contiene `scheduleAutoPrint` — FOUND (linea 524)
- Commit `f9f144a` — FOUND (`git log --oneline --all | grep f9f144a`)
- Commit `c40aa05` — FOUND (`git log --oneline --all | grep c40aa05`)
