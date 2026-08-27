# Roadmap: Lobo Burger — Ecommerce completo y listo para marketing

## Overview

La web ya cobra plata real en producción. Este milestone cierra los huecos entre
"cobra" y "es un ecommerce completo y seguro" sin romper el checkout en ningún
punto del camino. El orden de las fases sigue la cadena de dependencias reales
del código: primero se blinda el camino del dinero (webhook, idempotencia,
alertas, límite de intentos, tests) porque todo lo demás se construye sobre
`/api/charge`. Luego el menú se muda a Supabase, porque el control de stock y
la edición de precios sin deploy dependen de esa migración. Con el menú y el
cobro ya sólidos, se cierra la operación del local (horario, delivery cobrado,
aviso a cocina) y se abre el seguimiento público del pedido para el comprador.
El milestone cierra con analítica de ecommerce, el gate de negocio antes de
pautar.

**Nota de conteo:** `REQUIREMENTS.md` registraba "34 v1 requirements" como
placeholder previo al roadmap; el conteo real de la lista v1 es **38**
(PAY 7 + OPS 8 + DELV 4 + TRACK 4 + MENU 4 + ANLY 3 + INFRA 4 + CLEAN 4).
La tabla de Traceability y el Coverage de `REQUIREMENTS.md` quedan corregidos
a 38/38.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Integridad del pago y red de seguridad** - El cobro nunca pierde un pedido, nunca duplica uno, y alguien se entera el mismo día si algo falla.
- [ ] **Phase 2: Menú vivo en Supabase y control de stock** - Jaime cambia precio o agota un producto desde `/admin` sin deploy, y el cobro nunca usa un precio viejo.
- [ ] **Phase 3: Operación del local — horario, delivery cobrado y aviso a cocina** - El local no recibe pedidos que no puede cumplir, y la cocina se entera sin tener la web abierta.
- [ ] **Phase 4: Seguimiento público del pedido** - El comprador ve el estado de su pedido sin login, sin exponer datos de nadie más.
- [ ] **Phase 5: Analítica lista para pautar** - Cada venta se puede atribuir a una campaña antes de gastar el primer sol en pauta.

## Phase Details

### Phase 1: Integridad del pago y red de seguridad
**Goal**: Un pago confirmado por Culqi siempre se convierte en un pedido registrado en Supabase, con alertas si algo falla, y el servidor resiste intentos de abuso o de manipular precio y envío.
**Mode:** mvp
**Depends on**: Nothing (primera fase)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, INFRA-01, INFRA-02, INFRA-03, INFRA-04, CLEAN-02, CLEAN-03, CLEAN-04
**Success Criteria** (what must be TRUE):
  1. Un pago de Yape confirmado por Culqi genera su pedido en Supabase aunque el navegador se haya cerrado antes de terminar el checkout.
  2. Recibir el mismo evento de webhook dos veces, o que el webhook y `POST /api/charge` compitan por el mismo cargo, nunca produce dos pedidos ni un doble cobro.
  3. Si un cargo se cobra y el insert en Supabase falla, o si la base de datos deja de responder, una alerta llega a un humano el mismo día — no solo queda en logs de Vercel.
  4. Un script que golpea `/api/charge` con tarjetas robadas se frena por límite de intentos por IP, y un email o teléfono con formato inválido nunca llega a cobrarse.
  5. El repo tiene un runner de tests que falla si alguien vuelve a confiar en el precio o el envío que manda el navegador.
**Bloqueo externo**: PAY-01 depende de confirmar con Culqi el estado de verificación de la cuenta test (`DNGA9999`) antes de hacer el pago real que decide el diseño del webhook. Si Culqi no lo resuelve a tiempo, esta fase puede avanzar con PAY-05/06/07/INFRA-*/CLEAN-* y dejar PAY-02/03/04 explícitamente pendientes hasta que se despeje.
**Plans**: TBD

Plans:
- [x] 01-01: TBD

### Phase 2: Menú vivo en Supabase y control de stock
**Goal**: El menú vive en una tabla de Supabase, no en `lib/menu.ts`: Jaime cambia precio o marca agotado un producto desde `/admin` sin deploy, y `POST /api/charge` siempre cobra el precio vigente en la base, nunca uno cacheado.
**Mode:** mvp
**Depends on**: Phase 1 (mismo endpoint `/api/charge` y mismo runner de tests de precio)
**Requirements**: MENU-01, MENU-02, MENU-03, MENU-04, OPS-04
**Success Criteria** (what must be TRUE):
  1. Jaime edita el precio de un producto en `/admin` y el cambio se ve en la carta pública sin que nadie haga un deploy.
  2. La carta pública se sirve de caché con `revalidate`/tag y no golpea Supabase en cada visita.
  3. Un producto marcado agotado no se puede agregar al carrito, y si igual llega al servidor, `/api/charge` lo rechaza.
  4. Subir el precio de un producto en el panel hace que el siguiente cobro use el precio nuevo de inmediato, nunca uno servido desde caché vieja.
**Bloqueo externo**: la carga inicial de precios reales (MENU-03) depende de que Jaime entregue la carta actualizada; el mecanismo de edición se entrega igual, con los precios que hoy hay en `lib/menu.ts` como semilla.
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Operación del local — horario, delivery cobrado y aviso a cocina
**Goal**: El local no recibe pedidos que no puede cumplir — fuera de horario o fuera de zona de reparto — la cocina se entera de cada pedido sin tener la web abierta, y el delivery deja de salir del margen.
**Mode:** mvp
**Depends on**: Phase 1 (`/api/charge` ya blindado y con tests; ahí se agregan las validaciones de horario y zona)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-05, OPS-06, OPS-07, OPS-08, DELV-01, DELV-02, DELV-03, DELV-04
**Success Criteria** (what must be TRUE):
  1. Un intento de pago fuera del horario de atención (evaluado en hora de Lima) lo rechaza el servidor, aunque alguien lo fuerce sin pasar por la pantalla de checkout.
  2. Jaime cambia el horario de atención o pausa pedidos manualmente desde `/admin`, sin deploy y de forma independiente entre sí.
  3. Un pedido de delivery fuera del radio de 7.5 km de cualquier sede no se puede cobrar; dentro del radio paga tarifa plana bajo el monto mínimo o envío gratis por encima, calculado y verificado en el servidor con `lib/sedes.ts`.
  4. Cuando entra un pedido, el grupo de Telegram de cocina recibe el detalle (o queda una alerta visible si el aviso falla), y el panel `/admin` suena y muestra un badge sin abrir una segunda conexión de polling.
  5. El comprador puede escribir una nota libre por producto ("sin cebolla") y esa nota llega tanto a la cocina como al panel.
**Bloqueo externo**: OPS-05/06 (aviso a cocina) dependen de que Jaime entregue el grupo de Telegram y el token del bot; el resto de la fase se entrega sin bloquearse por esto.
**UI hint**: yes
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Seguimiento público del pedido
**Goal**: El comprador puede ver el estado de su pedido en un link público sin login y se entera por email cuando cambia, sin exponer datos de otros pedidos.
**Mode:** mvp
**Depends on**: Phase 1 (los pedidos ya se crean de forma confiable vía webhook, incluidos los que el navegador nunca confirmó)
**Requirements**: TRACK-01, TRACK-02, TRACK-03, TRACK-04
**Success Criteria** (what must be TRUE):
  1. Cada pedido nuevo genera un token aleatorio no adivinable, distinto del `codigo` correlativo (`LB-...`), y ese token es la única llave del link público.
  2. El comprador abre `/pedido/[token]` sin login, ve el estado de su pedido, y el link sigue funcionando si lo vuelve a abrir más tarde.
  3. Al cambiar el estado del pedido en `/admin`, el comprador recibe un email vía Resend.
  4. La página pública nunca muestra los datos de otro pedido, ni pide o expone más datos personales de los necesarios para confirmar que es el pedido correcto.
**Bloqueo externo**: TRACK-03 (email de cambio de estado) depende de que Jaime entregue `RESEND_API_KEY` y el correo del negocio; TRACK-01/02/04 se entregan igual.
**UI hint**: yes
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Analítica lista para pautar
**Goal**: Antes de gastar el primer sol en pauta, cada venta se puede atribuir a una campaña, y la web deja de prometer un sistema de puntos que no cumple.
**Mode:** mvp
**Depends on**: Phase 1 (el webhook ya existe, así que hay que decidir un único punto de disparo del evento `purchase` sin duplicarlo)
**Requirements**: ANLY-01, ANLY-02, ANLY-03, CLEAN-01
**Success Criteria** (what must be TRUE):
  1. GA4 y Meta Pixel están instalados en la web y disparan `view_item`, `add_to_cart`, `begin_checkout` y `purchase`.
  2. Cada pedido pagado genera un solo evento `purchase`, nunca dos, a pesar de que exista el webhook de Culqi.
  3. El sistema de puntos ("La Manada") ya no aparece en la web pública hasta que tenga persistencia real.
**Bloqueo externo**: ANLY-01/02 dependen de que Jaime entregue acceso a Meta Business (ID de Pixel) y la propiedad de GA4; sin eso, esta fase queda lista en código pero sin poder verificarse en producción.
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Integridad del pago y red de seguridad | 7/8 | In Progress|  |
| 2. Menú vivo en Supabase y control de stock | 0/TBD | Not started | - |
| 3. Operación del local — horario, delivery cobrado y aviso a cocina | 0/TBD | Not started | - |
| 4. Seguimiento público del pedido | 0/TBD | Not started | - |
| 5. Analítica lista para pautar | 0/TBD | Not started | - |
