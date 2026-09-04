---
phase: quick/260904-9uy
plan: 01
subsystem: admin-panel
tags: [refactor, whatsapp, deduplication]
dependency-graph:
  requires: []
  provides: ["buildWhatsAppUrl(order, opts?) unified message builder"]
  affects: [app/admin/page.tsx, lib/cart-context.tsx]
tech-stack:
  added: []
  patterns: ["optional-opts parameter to extend a pure function instead of duplicating it"]
key-files:
  created: []
  modified:
    - lib/cart-context.tsx
    - app/admin/page.tsx
    - __tests__/orders-store.test.ts
decisions:
  - "Extendí buildWhatsAppUrl con { to?, includeGps? } en vez de crear un builder separado; el reenvio a delivery converge al formato de mensaje del cliente (gana precios por linea, pierde el prefijo 'Cremas:' que era cosmetico)."
metrics:
  duration: "~15 min"
  completed: 2026-09-04
---

# Phase quick/260904-9uy Plan 01: Fix buildDeliveryForwardUrl duplicado en app/admin Summary

Unifica el armado del mensaje de WhatsApp del pedido: `buildDeliveryForwardUrl` en
`app/admin/page.tsx` reimplementaba lo mismo que `buildWhatsAppUrl` en `lib/cart-context.tsx`,
con formatos ya divergentes (etiquetas de encabezado, items sin precio, prefijo "Cremas:").

## Qué se hizo

- `buildWhatsAppUrl(order, opts?)` ahora acepta `{ to?: string; includeGps?: boolean }`.
  Sin `opts`, el output es byte a byte idéntico al de producción (test que lo congela).
  Con `opts.to` cambia solo el número de destino. Con `opts.includeGps: true` y
  `order.lat`/`order.lng` presentes, agrega una línea `GPS: https://maps.google.com/?q=<lat>,<lng>`
  inmediatamente después de la línea de delivery/recojo.
- `buildDeliveryForwardUrl` fue eliminada de `app/admin/page.tsx`. El botón "Reenviar a Delivery"
  ahora llama `buildWhatsAppUrl(o, { to: DELIVERY_FORWARD_NUMBER, includeGps: true })`.
- `formatPrice` sigue usándose en `app/admin/page.tsx` en otros puntos (líneas de item y total
  en la UI), así que su import se mantuvo — verificado con grep antes de tocarlo.

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito.

## Gate pre-vuelo (AGENTS.md)

```
$ npx tsc --noEmit
(sin output, exit 0)

$ npx vitest run
 Test Files  22 passed (22)
      Tests  195 passed (195)

$ npm run lint
/Users/facundomaco/conductor/repos/lobo-burger-demo/app/admin/page.tsx
  572:5  error  react-hooks/set-state-in-effect

/Users/facundomaco/conductor/repos/lobo-burger-demo/app/api/admin/pedidos/route.ts
  10:44  error    @typescript-eslint/no-explicit-any
  15:19  warning  @typescript-eslint/no-unused-vars
  22:46  error    @typescript-eslint/no-explicit-any

/Users/facundomaco/conductor/repos/lobo-burger-demo/lib/cart-context.tsx
  65:41  error  react-hooks/set-state-in-effect

✖ 5 problems (4 errors, 1 warning)
```

Paridad exacta con la baseline real medida 2026-09-04 (5 problemas: 3 `react-hooks/set-state-in-effect`
+ 2 `no-explicit-any` + 1 `no-unused-vars`, todos preexistentes, ninguno introducido por esta tarea).

## Verificación adicional

```
$ grep -c 'buildDeliveryForwardUrl' app/admin/page.tsx
0
$ grep -rn 'buildDeliveryForwardUrl' app components lib __tests__
(vacío)
$ grep -rn 'wa.me' app components lib
app/admin/page.tsx:105: (comentario explicativo, sin construcción de URL)
lib/cart-context.tsx:46: return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
```

Una sola construcción de URL `wa.me` en todo el repo.

## Known Stubs

Ninguno.

## Threat Flags

Ninguno. El cambio no introduce superficie nueva: el reenvio a delivery ya enviaba GPS en
`buildDeliveryForwardUrl` (T-9uy-02, disposition: accept, del threat model del plan); ahora
lo hace a través del mismo `encodeURIComponent` único (T-9uy-01, mitigate) que protegía el
mensaje del cliente.

## Self-Check: PASSED

- FOUND: lib/cart-context.tsx (buildWhatsAppUrl con opts)
- FOUND: app/admin/page.tsx (import buildWhatsAppUrl, sin buildDeliveryForwardUrl)
- FOUND: __tests__/orders-store.test.ts (tests de opts + freeze test)
- FOUND commit 8ae1b79 (test RED)
- FOUND commit 942bae8 (feat GREEN)
- FOUND commit d3d5e3e (refactor admin)
