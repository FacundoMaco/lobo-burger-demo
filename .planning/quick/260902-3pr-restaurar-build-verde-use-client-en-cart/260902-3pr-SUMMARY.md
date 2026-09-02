---
phase: quick-260902-3pr
plan: 01
subsystem: build-integrity
tags: [menu, cart-context, use-client, build-verde]
requires: []
provides:
  - "lib/menu.ts: MENU_ITEMS (17 filas), getMenuItem, BY_ID, CATEGORIES viejas"
  - "lib/menu-data.ts: MENU_CATEGORIES (6 categorias reales de Supabase)"
  - "lib/cart-context.tsx: \"use client\" restaurado como primera sentencia"
affects:
  - app/page.tsx
  - app/api/charge/route.ts
  - app/api/culqi/order/route.ts
  - app/admin/page.tsx (revertido a HEAD, sin cambios)
tech-stack:
  added: []
  patterns:
    - "Alineacion en columnas para literales tabulares (MENU_ITEMS)"
key-files:
  created:
    - __tests__/menu.test.ts
  modified:
    - lib/menu.ts
    - lib/menu-data.ts
    - lib/cart-context.tsx
decisions:
  - "app/admin/page.tsx se revirtio a HEAD (git checkout) descartando el KDS tactil sin commitear, que llamaba a endpoints inexistentes (/api/admin/puntos, /api/admin/canjear); backup preservado en .context/kds-admin-page.tsx.bak (no tocado por este plan)"
metrics:
  duration: "~15 min"
  completed: "2026-09-02"
---

# Quick Task 260902-3pr: Restaurar build verde (use client en cart) Summary

Restaurado el build verde de `pricing-desarrollo-3-cuotas`: `lib/menu.ts` recupera `MENU_ITEMS`/`getMenuItem`/`BY_ID`/`CATEGORIES` que tres archivos seguian importando, y `lib/cart-context.tsx` vuelve a tener `"use client"` como primera sentencia (rompia el 500 en todas las rutas).

## Que se hizo

**Task 1** (`b3d22a4`): `git checkout` de `lib/menu.ts` y `__tests__/menu.test.ts` desde el commit `875ae419`, con `agotado: boolean` reintroducido en el tipo y `agotado: false` en las 17 filas (contrato compartido con `lib/menu-data.ts`). Se saco el cast redundante `as string | null` de la fila `id: 13`. Las 6 categorias nuevas (`Enchiladas`, `Broaster`, etc.) se movieron a `lib/menu-data.ts` como `MENU_CATEGORIES`, para no colisionar con el `CATEGORIES` viejo de `lib/menu.ts` que `app/page.tsx` sigue usando.

**Task 2** (`1c3c96f`): en `lib/cart-context.tsx` se bajo el import de `formatPrice` al bloque de imports, dejando `"use client";` como primera linea. Se descartaron con `git checkout -- app/admin/page.tsx` los cambios sin commitear del KDS tactil (llamaban a `/api/admin/puntos` y `/api/admin/canjear`, endpoints inexistentes); el backup ya existente en `.context/kds-admin-page.tsx.bak` no se toco.

## Deviations from Plan

None - plan ejecutado tal como estaba escrito.

## Gate final — salida real

### `npx tsc --noEmit`
```
EXIT: 0
```
(sin output, limpio)

### `npx vitest run`
```
 RUN  v4.1.11 /Users/facundomaco/conductor/workspaces/lobo-burger-demo/los-angeles

 Test Files  14 passed (14)
      Tests  132 passed (132)
   Start at  02:49:45
   Duration  3.44s (transform 588ms, setup 0ms, import 11.48s, tests 225ms, environment 7.29s)

EXIT: 0
```

### `npm run lint`
```
/Users/facundomaco/conductor/workspaces/lobo-burger-demo/los-angeles/__tests__/helpers/supabase-mock.ts
  79:16  warning  'cols' is defined but never used          @typescript-eslint/no-unused-vars
  80:38  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  86:29  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  86:43  error    Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/facundomaco/conductor/workspaces/lobo-burger-demo/los-angeles/__tests__/menu-data.test.ts
   7:24  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  14:17  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/Users/facundomaco/conductor/workspaces/lobo-burger-demo/los-angeles/app/admin/page.tsx
  296:5  error  Error: Calling setState synchronously within an effect can trigger cascading renders
  ...  react-hooks/set-state-in-effect

/Users/facundomaco/conductor/workspaces/lobo-burger-demo/los-angeles/app/puntos/page.tsx
  121:14  error  Error: Calling setState synchronously within an effect can trigger cascading renders
  ...  react-hooks/set-state-in-effect

/Users/facundomaco/conductor/workspaces/lobo-burger-demo/los-angeles/lib/cart-context.tsx
  61:41  error  Error: Calling setState synchronously within an effect can trigger cascading renders
  ...  react-hooks/set-state-in-effect

✖ 9 problems (8 errors, 1 warning)

EXIT: 1
```

**Nota sobre el gate de lint:** el mensaje de la tarea decia que la unica regla esperada era `react-hooks/set-state-in-effect`, pero el PLAN.md (medido empiricamente por el orquestador antes de arrancar) documenta una baseline mas amplia: `10 problems (8 errors, 2 warnings)` distribuidos en `__tests__/helpers/supabase-mock.ts`, `__tests__/menu-data.test.ts`, `app/admin/page.tsx`, `app/puntos/page.tsx` y `lib/cart-context.tsx`. Esos dos archivos de test (`no-explicit-any`, `no-unused-vars`) estan en `<no_toques>` y no se tocaron en este plan — son preexistentes, no una regresion introducida aca. Lo que exigia el plan como criterio de cierre se cumplio: **`@typescript-eslint/no-unused-expressions` desaparecio** (era el sintoma de la directiva `"use client"` mal ubicada) y **no aparecio ninguna regla nueva**: 9 problems ahora vs. 10 antes, exactamente el warning que debia irse. `npm run lint` sigue con exit code 1 por la baseline preexistente, tal como el plan preveia.

## Self-Check: PASSED

- FOUND: `lib/menu.ts` (existe, exporta `MENU_ITEMS`, `getMenuItem`, `CATEGORIES`)
- FOUND: `lib/menu-data.ts` (existe, exporta `MENU_CATEGORIES`)
- FOUND: `__tests__/menu.test.ts` (existe, 3 tests)
- FOUND: `lib/cart-context.tsx` (linea 1 = `"use client";`)
- `git status --short app/admin/page.tsx` → vacio (confirmado)
- Commit `b3d22a4` → `git log --oneline --all | grep b3d22a4` → encontrado
- Commit `1c3c96f` → `git log --oneline --all | grep 1c3c96f` → encontrado
