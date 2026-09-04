---
phase: quick-260904-a1c
plan: 01
subsystem: app/admin/page.tsx (KDS chime)
tags: [kds, audio, timbre, gate]
requires: []
provides: [chimeGate, CHIME_MIN_GAP_MS]
affects: [app/admin/page.tsx (playOrderChime + toggle "Timbre ON")]
tech-stack:
  added: []
  patterns: ["gate puro de espaciado minimo, timing por parametro (mismo estilo que lib/auto-print.ts)"]
key-files:
  created:
    - lib/chime-gate.ts
    - __tests__/chime-gate.test.ts
  modified:
    - app/admin/page.tsx
decisions: []
metrics:
  duration: "~15 min"
  completed: 2026-09-04
---

# Quick Task 260904-a1c: Fix en app/admin/page.tsx el chime inmediato Summary

Eliminado el doble beep del KDS: `playOrderChime` ahora consulta un gate puro
(`lib/chime-gate.ts`) que bloquea cualquier chime que caiga a menos de 1200ms del
anterior, sin re-fasear el `setInterval` de 2.5s del timbre persistente.

## Task 1: Gate puro de espaciado minimo entre chimes

**Commit:** 2b625e1

- `lib/chime-gate.ts`: modulo puro (sin `"use client"`, sin DOM, sin React, sin
  `Date.now()` interno). Exporta `CHIME_MIN_GAP_MS = 1200` y
  `createChimeGate(minGapMs?)` devolviendo `{ shouldPlay(now), reset() }`.
  `shouldPlay` cierra sobre `lastAt: number | null`; una llamada bloqueada NO
  actualiza `lastAt` (mitigacion del threat T-a1c-01: una rafaga de pedidos no
  puede silenciar el timbre indefinidamente).
- `__tests__/chime-gate.test.ts`: 8 casos (primera llamada nunca bloquea, bloqueo
  dentro de la ventana, borde inclusivo en 1200ms, bloqueo no extiende la
  ventana, `reset()` libera de inmediato, gap custom, gates independientes,
  valor de `CHIME_MIN_GAP_MS`). Sin fake timers — el tiempo es argumento.

## Task 2: Cablear el gate en playOrderChime del KDS

**Commit:** 4e96b96

- Import absoluto `import { createChimeGate } from "@/lib/chime-gate"`.
- `const chimeGate = createChimeGate()` a nivel de modulo, junto al singleton
  `globalAudioCtx` — mismo reloj compartido por los tres emisores existentes
  (polling `refresh()`, interval del timbre persistente, simulacion de pedido).
- `playOrderChime()`: primera sentencia del cuerpo es
  `if (!chimeGate.shouldPlay(Date.now())) return;`, antes del `try` que crea/
  resume el `AudioContext` — evita tocar el AudioContext en llamadas que no van
  a sonar.
- Los tres call sites existentes (simulacion, chime inmediato del pedido
  entrante, tick del interval) no se tocaron: siguen llamando a
  `playOrderChime()` igual, el gate decide. El efecto del timbre persistente y
  sus deps (`[pending, audioEnabled]`) quedaron intactos.
- Unico call site que cambio: el toggle "Timbre ON" — cuando `next === true`
  ahora llama `chimeGate.reset()` inmediatamente antes de `playOrderChime()`,
  para que la confirmacion sonora nunca se trague por la ventana de 1200ms.
- Comentario del efecto del timbre persistente actualizado explicando que los
  chimes pasan por `chimeGate` y que la repeticion efectiva queda en <=2.5s.
- Verificado con grep que no queda ningun otro llamador de `playOrderChime`
  fuera de los 4 sitios esperados (definicion + 3 call sites originales + el
  toggle).

## Deviations from Plan

None - plan executed exactly as written.

## Gate Output (real)

```
$ npx tsc --noEmit && npx vitest run && npm run lint
```

`tsc --noEmit`: sin salida, exit 0.

`vitest run`:
```
 RUN  v4.1.11 /Users/facundomaco/conductor/repos/lobo-burger-demo

 Test Files  23 passed (23)
      Tests  205 passed (205)
   Start at  07:17:01
   Duration  1.94s (transform 553ms, setup 0ms, import 3.83s, tests 323ms, environment 5.08s)
```

`npm run lint` (exit 1, en paridad con la baseline real medida 2026-09-04 de 5 problemas):
```
/Users/facundomaco/conductor/repos/lobo-burger-demo/app/admin/page.tsx
  578:5  error  Error: Calling setState synchronously within an effect can trigger cascading renders  react-hooks/set-state-in-effect

/Users/facundomaco/conductor/repos/lobo-burger-demo/app/api/admin/pedidos/route.ts
  10:44  error    Unexpected any. Specify a different type    @typescript-eslint/no-explicit-any
  15:19  warning  'error' is assigned a value but never used  @typescript-eslint/no-unused-vars
  22:46  error    Unexpected any. Specify a different type    @typescript-eslint/no-explicit-any

/Users/facundomaco/conductor/repos/lobo-burger-demo/lib/cart-context.tsx
  65:41  error  Error: Calling setState synchronously within an effect can trigger cascading renders  react-hooks/set-state-in-effect

✖ 5 problems (4 errors, 1 warning)
```

2 `react-hooks/set-state-in-effect` (app/admin/page.tsx, lib/cart-context.tsx) +
2 `no-explicit-any` + 1 `no-unused-vars` en `app/api/admin/pedidos/route.ts`,
todos preexistentes, ninguna regla nueva, ningun archivo nuevo con errores.
Mismas categorias de regla que la baseline documentada.

No se corrio verificacion E2E/browser — no es confiable en este sandbox (ver
STATE.md); el gate automatizado es la verificacion para esta tarea, tal como
indica el constraint de la orquestacion.

## Self-Check

```
$ [ -f lib/chime-gate.ts ] && echo FOUND
FOUND: lib/chime-gate.ts

$ [ -f __tests__/chime-gate.test.ts ] && echo FOUND
FOUND: __tests__/chime-gate.test.ts

$ git log --oneline --all | grep -q 2b625e1 && echo FOUND
FOUND: 2b625e1

$ git log --oneline --all | grep -q 4e96b96 && echo FOUND
FOUND: 4e96b96
```

## Self-Check: PASSED
