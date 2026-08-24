# Lobo Burger

## What This Is

Web de pedidos online de Lobo Burger, una hamburguesería de barrio en Lima, ya en
producción y cobrando soles reales en https://loboburger.com. El cliente es Jaime,
el dueño. La web ya vende: carta con fotos, carrito, checkout con Culqi embebido
(tarjeta y Yape), pedidos en Supabase y panel de administración. Este milestone
cierra los huecos que quedan entre "cobra" y "es un ecommerce completo y seguro"
para poder hacer marketing pago a los clientes que hoy ya consumen en el local.

## Core Value

Que un pedido pagado siempre llegue a la cocina, con el precio correcto, y que
nadie pueda pagar cuando el local no puede cumplirlo.

## Requirements

### Validated

Verificado contra el código en `.planning/codebase/CONCERNS.md` (auditoría 2026-08-24,
sección "Resolved — Fase A"), commit `eb9f243`.

- ✓ El servidor recalcula el total contra `lib/menu.ts`; el navegador solo manda `{id, qty}` — existente (`app/api/charge/route.ts:57-77`)
- ✓ Los pedidos se guardan en Supabase en la misma petición que crea el cargo — existente (`app/api/charge/route.ts:110-133`)
- ✓ Idempotencia por `culqi_charge_id` único, con manejo del error 23505 — existente (`supabase/migrations/20260820000000_pedidos.sql:5`)
- ✓ Panel `/admin` detrás de Basic Auth, falla cerrado si faltan credenciales — existente (`proxy.ts`)
- ✓ Checkout Culqi Custom embebido con tarjeta y Yape, estilado con los tokens de marca — existente (`lib/culqi.ts`)
- ✓ Carrito persistente en localStorage — existente (`lib/cart-context.tsx`)
- ✓ Libro de reclamaciones (Ley 32495) con folio correlativo, constancia imprimible y persistencia en Supabase con RLS — existente
- ✓ Mapa de delivery con Leaflet + OpenStreetMap validando radio de 7.5 km por sede con haversine — existente (`lib/sedes.ts`, `components/delivery-map.tsx`)
- ✓ Términos y condiciones, SEO con JSON-LD, sitemap y robots, dominio propio con SSL — existente

### Active

**Integridad del pago**
- [ ] Un pago de Yape confirmado por Culqi genera el pedido aunque el navegador se haya cerrado (webhook `charge.succeeded` con firma verificada, upsert idempotente por `culqi_charge_id`)
- [ ] Un cargo exitoso cuyo insert en Supabase falla dispara una alerta que un humano ve el mismo día
- [ ] `/api/charge` resiste card testing: límite de intentos por IP
- [ ] La base de datos no se autopausa y tira producción: cron keep-warm + alerta ahora, Supabase Pro antes de pautar
- [ ] Los errores de `/api/charge` y `/api/reclamaciones` llegan a una herramienta de monitoreo, no solo a los logs de Vercel

**Operación**
- [ ] El local no acepta pedidos fuera de su horario de atención; el horario se edita desde el panel sin deploy
- [ ] Un producto agotado no se puede agregar al carrito ni cobrar
- [ ] Cuando entra un pedido, la cocina se entera sin tener la web abierta (Telegram al grupo) y el panel avisa con sonido y badge
- [ ] El delivery deja de salir del margen: gratis sobre un monto mínimo, tarifa plana por debajo, calculado y cobrado en el servidor
- [ ] El comprador puede ver el estado de su pedido en un link público sin login y recibe un email cuando el estado cambia
- [ ] El comprador puede dejar una nota libre por producto ("sin cebolla") que llega a la cocina

**Autonomía del cliente**
- [ ] Jaime puede cambiar el precio de un producto o marcarlo agotado desde el panel, sin deploy y sin llamarme

**Marketing**
- [ ] GA4 y Meta Pixel instalados con eventos de ecommerce (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) antes de gastar el primer sol en pauta

**Higiene**
- [ ] El sistema de puntos deja de prometer algo que no cumple: se oculta hasta rehacerlo con persistencia real
- [ ] `lib/orders-store.ts` deja de escribir copias muertas en localStorage y los botones de pedido de prueba del panel se eliminan

### Out of Scope

- **Boleta electrónica SUNAT** — decisión de negocio pendiente de Jaime y su contador (DIY vs proveedor con API tipo Nubefact/Bsale, con costo a presentarle). Se documenta como TODO, no entra en este milestone.
- **Modificadores estructurados con precio** (extra queso +S/3) — la nota libre cubre el caso real hoy; los modificadores con precio obligan a recalcular el total con opciones en el servidor y no valen esa complejidad todavía.
- **CRUD completo del menú** (alta/baja de productos, fotos, categorías desde el panel) — el panel edita solo precio y agotado en v1. El CRUD entra cuando exista el backoffice/kanban.
- **Migrar el sistema de puntos a Supabase** — no toca plata; se oculta ahora y se rehace en un milestone posterior.
- **Pedido programado, alérgenos, tiempo estimado, carrito abandonado** — de la auditoría sección 2.7/2.8/2.10 y 4; útiles pero no bloquean el marketing.
- **Suite de tests automatizada completa** — el repo no tiene runner. Se cubre solo la lógica de precio/idempotencia de `/api/charge`, que es la que mueve plata.
- **RUC y razón social reales** — dato de Jaime, no de código. Hoy salen como `[PENDIENTE]` en la constancia del libro de reclamaciones.

## Context

**Producción y dinero real.** La web ya cobra con llaves live de Culqi. Cualquier
cambio en el flujo de pago se despliega sobre clientes que están pagando.

**Auditoría previa.** `.context/INVESTIGACION-PEDIDOS-ONLINE.md` es la auditoría
pre-lanzamiento con los huecos priorizados en Fases A/B/C. La Fase A ya está
ejecutada y verificada. Este milestone cubre Fase B + Fase C.
`.planning/codebase/CONCERNS.md` es la auditoría de código posterior, con 12
riesgos abiertos y evidencia línea por línea. Ambos documentos son la fuente de
verdad del alcance; el roadmap no debe redescubrirlos.

**Next.js 16.2.9 tiene breaking changes.** `middleware.ts` ya no existe: es
`proxy.ts` en la raíz. `AGENTS.md` obliga a leer `node_modules/next/dist/docs/`
antes de escribir código. No asumir convenciones de Next del conocimiento previo.

**Historial de incidentes.** El proyecto de Supabase en plan free se autopausó por
inactividad y tiró abajo el libro de reclamaciones en producción con un 500 — una
funcionalidad legalmente obligatoria (Ley N° 32495, multa de 1 UIT ≈ S/5,500).

**Sin tests.** No hay runner ni un solo test en el repo. La lógica de precio de
`/api/charge` — el arreglo exacto del exploit de cobrar S/3 por un pedido de S/38,
demostrado el 2026-08-20 — no tiene regresión que la proteja.

**Culqi en test devolvía DNGA9999** a todas las tarjetas, incluidas las de prueba
documentadas por Culqi, pendiente de verificación de cuenta. `.context/DEPLOY.md`
está desactualizado; verificar contra el panel de Culqi antes de confiar en él.

**Resend ya está instalado** (`resend` 6.20.0) y en uso para reclamaciones, así que
la notificación de estado al cliente reusa infraestructura existente — pero
`RESEND_API_KEY` y el correo del negocio siguen pendientes de Jaime.

## Constraints

- **Producción**: la web cobra plata real hoy — ningún cambio puede dejar el checkout roto ni perder pedidos durante el despliegue.
- **Presupuesto**: el negocio no está invirtiendo en este momento. Toda solución debe funcionar en free tier o ser gratis. Lo que cueste dinero (Supabase Pro, proveedor de SUNAT, WhatsApp Cloud API) se le presenta a Jaime como decisión suya, no se asume.
- **Legal**: el libro de reclamaciones (Ley N° 32495) no puede caerse. La boleta electrónica de SUNAT es obligatoria para venta a consumidor final y hoy no se emite.
- **Tech stack**: Next.js 16.2.9 App Router + TypeScript strict + Tailwind 4, Vercel, Culqi Checkout Custom (REST directo, sin SDK), Supabase. No introducir frameworks nuevos.
- **Free tier de Supabase**: minimizar lecturas por request. El menú se sirve de caché de Next con invalidación por tag, no se golpea la DB en cada carga de la carta.
- **Dependencias de Jaime**: `RESEND_API_KEY` + correo del negocio, RUC y razón social, precios reales de la carta, acceso a Meta Business. Bloquean partes del alcance, no todo.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Aviso a la cocina por bot de Telegram al grupo, más sonido y badge en `/admin` | Gratis e instantáneo, sin verificación de negocio de Meta ni plantillas aprobadas. El sonido en el panel cubre el turno con la tablet abierta; Telegram cubre cuando nadie la mira | — Pending |
| Supabase: cron keep-warm ahora, plan Pro antes de pautar | El cron es gratis y mitiga hoy; Pro elimina la autopausa de raíz pero cuesta plata que el negocio no está poniendo todavía | — Pending |
| Delivery gratis sobre un monto mínimo, tarifa plana por debajo | Empuja el ticket promedio en vez de solo tapar el costo, y es fácil de explicar al cliente en la web | — Pending |
| Menú entero a una tabla de Supabase + caché con `revalidate` e invalidación por tag; el panel edita solo precio y agotado en v1 | Un override sobre `lib/menu.ts` no ahorra costo (la tabla es de ~30 filas y la caché evita las lecturas por request), solo posterga deuda. El CRUD completo espera al backoffice | — Pending |
| Modificadores como nota libre por producto, no opciones estructuradas | Cero modelado, cubre el caso real ("sin cebolla"). Las opciones con precio obligan a recalcular el total con modificadores en el servidor — complejidad que no se justifica hoy | — Pending |
| Horario de atención en Supabase, editable desde el panel | Jaime cierra por feriado sin llamarme; hardcodearlo repite el problema del menú | — Pending |
| Estado del pedido: link público `/pedido/[codigo]` sin login + email al cambiar de estado | Sin login no hay fricción; el `codigo` ya se genera por pedido. El email reusa Resend, ya instalado | — Pending |
| GA4 + Meta Pixel con eventos de ecommerce, no solo pageviews | Ambos son gratis. Sin el evento `purchase` la pauta no se puede optimizar por conversión y se paga a ciegas | — Pending |
| Sistema de puntos: ocultarlo, no migrarlo | Hoy vive en localStorage y se pierde al cambiar de celular — promete algo que no cumple. Ocultarlo es barato; migrarlo no toca plata y puede esperar | — Pending |
| Boleta electrónica SUNAT fuera del milestone | Depende del contador de Jaime y de un gasto que él debe aprobar. Se documenta como TODO con las alternativas evaluadas | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-24 after initialization*
