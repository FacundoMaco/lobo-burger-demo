---
phase: quick-260904-9yt
plan: 01
subsystem: lib/menu.ts
tags: [menu, cremas, derivacion]
requires: []
provides: [CATEGORIAS_CON_CREMAS derivada]
affects: [app/page.tsx (consumidor, sin cambios)]
tech-stack:
  added: []
  patterns: ["derivar constante de UI via filter en vez de literal duplicado"]
key-files:
  created: []
  modified:
    - lib/menu.ts
    - __tests__/menu.test.ts
decisions: []
metrics:
  duration: "~10 min"
  completed: 2026-09-04
---

# Quick Task 260904-9yt: Fix CATEGORIAS_CON_CREMAS en lib/menu.ts Summary

`CATEGORIAS_CON_CREMAS` (lib/menu.ts) dejo de ser un literal copiado a mano y pasa a derivarse de `CATEGORIES` via `filter` con una lista de exclusion explicita (`CATEGORIAS_ESTATICAS_SIN_CREMAS = ["Bebidas"]`), para que una categoria nueva agregada a `CATEGORIES` lleve cremas por defecto en vez de perder el selector en silencio.

## Task 1: Derivar CATEGORIAS_CON_CREMAS de CATEGORIES

**Commit:** eae00ea

- `lib/menu.ts`: se agrego `const CATEGORIAS_ESTATICAS_SIN_CREMAS = ["Bebidas"]` inmediatamente antes de `CATEGORIAS_CON_CREMAS`, y `CATEGORIAS_CON_CREMAS` paso de literal a `CATEGORIES.filter((c) => !CATEGORIAS_ESTATICAS_SIN_CREMAS.includes(c))`. Comentario actualizado explicando el fail-open deliberado del lado cliente y que la validacion real vive en `categoriaAdmiteCremas()`.
- `CATEGORIAS_SIN_CREMAS` y `categoriaAdmiteCremas` (deny-list de la taxonomia viva de Postgres, quick task 260904-9po) quedaron byte-identicos, sin tocar.
- `__tests__/menu.test.ts`: se agrego el import de `CATEGORIES` y un nuevo `describe("CATEGORIAS_CON_CREMAS")` con dos casos: valor exacto congelado (`toEqual(["Combos","Burgers","Pollo","Complementos"])`) e invariante de derivacion (`CATEGORIAS_CON_CREMAS` == `CATEGORIES` menos `"Bebidas"`, y no contiene `"Bebidas"`). El test preexistente de invariante deny-list vs allow-list sigue pasando sin modificaciones.
- `app/page.tsx` no requirio cambios (sigue importando y usando `CATEGORIAS_CON_CREMAS.includes(...)` igual que antes).

## Deviations from Plan

None - plan executed exactly as written.

## Gate Output (real)

```
$ npx tsc --noEmit && npx vitest run && npm run lint
```

`tsc --noEmit`: sin salida, exit 0 (implicito, ya que el `&&` siguio a vitest).

`vitest run`:
```
 RUN  v4.1.11 /Users/facundomaco/conductor/repos/lobo-burger-demo

 Test Files  22 passed (22)
      Tests  197 passed (197)
   Start at  07:12:34
   Duration  1.65s (transform 644ms, setup 0ms, import 4.05s, tests 305ms, environment 4.76s)
```

`npm run lint` (exit 1, en paridad con la baseline real medida 2026-09-04 de 5 problemas):
```
/Users/facundomaco/conductor/repos/lobo-burger-demo/app/admin/page.tsx
  572:5  error  Error: Calling setState synchronously within an effect can trigger cascading renders  react-hooks/set-state-in-effect

/Users/facundomaco/conductor/repos/lobo-burger-demo/app/api/admin/pedidos/route.ts
  10:44  error    Unexpected any. Specify a different type    @typescript-eslint/no-explicit-any
  15:19  warning  'error' is assigned a value but never used  @typescript-eslint/no-unused-vars
  22:46  error    Unexpected any. Specify a different type    @typescript-eslint/no-explicit-any

/Users/facundomaco/conductor/repos/lobo-burger-demo/lib/cart-context.tsx
  65:41  error  Error: Calling setState synchronously within an effect can trigger cascading renders  react-hooks/set-state-in-effect

✖ 5 problems (4 errors, 1 warning)
```

3 `react-hooks/set-state-in-effect` (app/admin/page.tsx, app/admin/page.tsx via cart-context, lib/cart-context.tsx) + 2 `no-explicit-any` + 1 `no-unused-vars` en `app/api/admin/pedidos/route.ts`, todos preexistentes, ninguna regla nueva, ningun archivo nuevo con errores. Paridad confirmada con la baseline.

No se corrio verificacion E2E/browser — no es confiable en este sandbox (ver STATE.md); el gate automatizado es la verificacion para esta tarea.

## Self-Check

```
$ grep -n 'CATEGORIES.filter' lib/menu.ts
export const CATEGORIAS_CON_CREMAS = CATEGORIES.filter(
FOUND

$ git log --oneline --all | grep -q eae00ea && echo FOUND || echo MISSING
FOUND
```

## Self-Check: PASSED
