---
phase: quick-260904-9po
plan: 01
subsystem: pagos
tags: [charge, cremas, validacion, seguridad]
requires: []
provides:
  - categoriaAdmiteCremas() en lib/menu.ts
  - category en getMenuItemLive()
  - rechazo 400 de cremas invalidas por categoria y por duplicados en /api/charge
affects:
  - app/api/charge/route.ts
tech-stack:
  added: []
  patterns:
    - "deny-list en vez de allow-list cuando dos taxonomias de datos no coinciden"
key-files:
  created:
    - __tests__/api-charge.cremas.test.ts
  modified:
    - lib/menu.ts
    - lib/menu-data.ts
    - __tests__/helpers/menu-data-mock.ts
    - __tests__/menu.test.ts
    - __tests__/menu-data.test.ts
    - __tests__/api-cotizar.test.ts
    - app/api/charge/route.ts
decisions:
  - "CATEGORIAS_SIN_CREMAS = ['Bebidas'] como deny-list explicito, en vez de reusar CATEGORIAS_CON_CREMAS como allow-list: las categorias de lib/menu.ts (carta estatica) y las de la tabla menu_items en Postgres no coinciden salvo por 'Bebidas', y un allow-list ingenuo hubiera devuelto 400 en todo pedido real."
metrics:
  duration: "~25 min"
  completed: "2026-09-04"
---

# Quick Task 260904-9po: Validacion de cremas en /api/charge Summary

Cierra el hueco de validacion de cremas en la ruta de cobro real: `/api/charge`
aceptaba `cremas` para cualquier item (incluidas Bebidas) y aceptaba valores
repetidos dentro del mismo array, ensuciando la comanda de cocina.

## Que se hizo

**Task 1 — Elegibilidad de cremas en `lib/menu.ts` y `category` en el lookup en vivo**

- `lib/menu.ts`: nuevo export `CATEGORIAS_SIN_CREMAS = ["Bebidas"]` y funcion pura
  `categoriaAdmiteCremas(category)`, fail-closed (`false` para `undefined`/`null`/`""`).
  Implementada como deny-list a proposito: `CATEGORIAS_CON_CREMAS` (carta estatica,
  `app/page.tsx`) y las categorias reales de `menu_items` en Postgres no coinciden
  salvo por `"Bebidas"`.
- `lib/menu-data.ts`: `getMenuItemLive` ahora tambien devuelve `category`, tanto en
  el camino Supabase (`select` ampliado) como en el fallback a `MENU_ITEMS`. Cambio
  aditivo, no toca la advertencia MENU-04 ni el cacheo.
- `__tests__/helpers/menu-data-mock.ts`: `ItemCatalogo` gana `category`, poblado con
  la categoria real del seed para cada fixture.
- `__tests__/menu.test.ts`: nuevo `describe("categoriaAdmiteCremas")` con los cinco
  casos del plan, incluida la invariante contra `CATEGORIAS_CON_CREMAS`.

**Task 2 — Rechazo 400 en `/api/charge`**

- Import de `categoriaAdmiteCremas` desde `@/lib/menu`.
- Dentro del chequeo existente de `cremas` (formato, `CREMAS_MAX`, `CREMAS_OPCIONES`),
  se agrego el rechazo por duplicados: `new Set(cremas).size !== cremas.length`.
- Despues del lookup en vivo y del chequeo de `agotado` (recien ahi se conoce la
  categoria), se agrego: si `cremas?.length` y `!categoriaAdmiteCremas(item.category)`,
  responde 400 `{ error: "Ese producto no lleva cremas" }`.
- Ambos rechazos ocurren antes del `fetch` a Culqi.
- `__tests__/api-charge.cremas.test.ts`: cubre bebida con cremas (400, sin llamar a
  Culqi), duplicados (400), caso feliz (200, cremas persistidas en `detalle`), cremas
  ausente/vacia sobre bebida (200, sin campo `cremas`), y los rechazos preexistentes
  por opciones invalidas / exceso de `CREMAS_MAX`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Tipos rotos en `__tests__/api-cotizar.test.ts`**
- **Found during:** Task 1 (verificacion `npx tsc --noEmit`)
- **Issue:** El nuevo campo requerido `category` en el tipo de retorno de
  `getMenuItemLive` rompio la compilacion de tres `mockResolvedValueOnce` en
  `api-cotizar.test.ts` (archivo no listado en `files_modified` del plan, pero
  bloqueado por el cambio aditivo de Task 1).
- **Fix:** Se agrego `category: "Burgers"` a los tres objetos mockeados.
- **Files modified:** `__tests__/api-cotizar.test.ts`
- **Commit:** 5bde73a

## Self-Check: PASSED

- FOUND: lib/menu.ts (categoriaAdmiteCremas exportado)
- FOUND: lib/menu-data.ts (category en getMenuItemLive)
- FOUND: __tests__/api-charge.cremas.test.ts
- FOUND: app/api/charge/route.ts (categoriaAdmiteCremas importado y usado)
- FOUND commit 5bde73a
- FOUND commit 7d1cca5

## Verificacion (gate AGENTS.md #2)

```
$ npx tsc --noEmit && npx vitest run && npm run lint
```

- `npx tsc --noEmit`: limpio, sin salida.
- `npx vitest run`: **188/188 tests, 22/22 archivos, en verde.**
  ```
   Test Files  22 passed (22)
        Tests  188 passed (188)
  ```
- `npm run lint`: **5 problemas, exactamente la baseline real medida 2026-09-04**
  (3 `react-hooks/set-state-in-effect` en `app/admin/page.tsx` y
  `lib/cart-context.tsx`, 2 `no-explicit-any` + 1 `no-unused-vars` en
  `app/api/admin/pedidos/route.ts`). Ninguna regla nueva, ningun archivo nuevo con
  errores.

Invariante adicional del plan (`grep -rn "CATEGORIAS_CON_CREMAS" app lib`): sigue
mostrando unicamente el uso intacto en `app/page.tsx:72` y la definicion en
`lib/menu.ts` — no se toco.

## Commits

- `5bde73a` — feat(260904-9po): categoriaAdmiteCremas deny-list y category en getMenuItemLive
- `7d1cca5` — fix(260904-9po): rechazar cremas sobre categorias no elegibles y duplicadas en /api/charge
