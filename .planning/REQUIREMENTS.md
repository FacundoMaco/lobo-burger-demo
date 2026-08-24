# Requirements: Lobo Burger — Ecommerce completo y listo para marketing

**Defined:** 2026-08-24
**Core Value:** Que un pedido pagado siempre llegue a la cocina, con el precio correcto, y que nadie pueda pagar cuando el local no puede cumplirlo.

Alcance derivado de `.context/INVESTIGACION-PEDIDOS-ONLINE.md` (Fases B y C; la Fase A
ya está ejecutada), de `.planning/codebase/CONCERNS.md` (12 riesgos abiertos con
evidencia de código) y de `.planning/research/PITFALLS.md`.

## v1 Requirements

### Integridad del pago

- [ ] **PAY-01**: Verificar con un pago real de Yape cuál flujo de Culqi está activo (token síncrono `chr_...` vs orden de pago asíncrona `ord_...`) y dejarlo documentado, antes de diseñar el webhook
- [ ] **PAY-02**: Un pago confirmado por Culqi genera el pedido aunque el navegador se haya cerrado, vía webhook en `app/api/culqi/webhook/route.ts`
- [ ] **PAY-03**: El webhook no confía en el body: re-consulta el cargo contra la API de Culqi antes de escribir en `pedidos`
- [ ] **PAY-04**: Recibir el mismo evento de webhook dos veces no crea un pedido duplicado ni cobra dos veces, y la carrera entre el webhook y `POST /api/charge` resuelve en un solo pedido
- [ ] **PAY-05**: Un cargo exitoso cuyo insert en Supabase falla dispara una alerta que un humano ve el mismo día, en vez de solo un `console.error`
- [ ] **PAY-06**: `POST /api/charge` limita los intentos por IP con un contador que sobrevive entre invocaciones serverless de Vercel
- [ ] **PAY-07**: `POST /api/charge` valida formato de email y teléfono en el servidor, no solo en el navegador

### Operación del local

- [ ] **OPS-01**: Un pedido fuera del horario de atención no se puede pagar; el rechazo lo decide el servidor, no el navegador
- [ ] **OPS-02**: El horario de atención se guarda en Supabase y Jaime lo edita desde `/admin` sin deploy
- [ ] **OPS-03**: El horario se evalúa en zona horaria `America/Lima`, no en la hora local del servidor de Vercel
- [ ] **OPS-04**: Un producto marcado agotado no se puede agregar al carrito ni cobrar; el bloqueo se valida también en el servidor
- [ ] **OPS-05**: Cuando entra un pedido, un bot de Telegram lo avisa al grupo de cocina con el detalle del pedido
- [ ] **OPS-06**: Si el aviso de Telegram falla, queda registrado y alerta — no falla en silencio
- [ ] **OPS-07**: El panel `/admin` avisa con sonido y badge cuando entra un pedido nuevo
- [ ] **OPS-08**: El comprador puede dejar una nota libre por producto y esa nota llega a la cocina y al panel

### Delivery cobrado

- [ ] **DELV-01**: El pedido con delivery paga tarifa plana por debajo de un monto mínimo y envío gratis por encima; el servidor calcula el envío, no el navegador
- [ ] **DELV-02**: El servidor valida que la dirección esté dentro del radio de 7.5 km de alguna sede antes de cobrar, usando el haversine de `lib/sedes.ts`
- [ ] **DELV-03**: El umbral de envío gratis y la tarifa se configuran sin deploy
- [ ] **DELV-04**: El checkout muestra el costo de envío y cuánto falta para el envío gratis antes de pagar

### Estado del pedido para el comprador

- [ ] **TRACK-01**: Cada pedido genera un token aleatorio no adivinable, distinto del `codigo` correlativo, que es el que va en el link público
- [ ] **TRACK-02**: El comprador ve el estado de su pedido en `/pedido/[token]` sin login, y el link sigue funcionando si vuelve a abrirlo después
- [ ] **TRACK-03**: El comprador recibe un email vía Resend cuando su pedido cambia de estado
- [ ] **TRACK-04**: La página pública no expone datos de otros pedidos ni más datos personales de los necesarios

### Menú administrable

- [ ] **MENU-01**: El menú vive en una tabla de Supabase, no en un array de `lib/menu.ts`
- [ ] **MENU-02**: La carta pública se sirve desde caché de Next y no golpea Supabase en cada visita
- [ ] **MENU-03**: Jaime cambia el precio de un producto o lo marca agotado desde `/admin`, y el cambio se ve en la carta pública sin deploy
- [ ] **MENU-04**: `POST /api/charge` cobra siempre el precio vigente en la base, nunca un precio servido desde caché vieja

### Analítica para pautar

- [ ] **ANLY-01**: GA4 y Meta Pixel están instalados en la web
- [ ] **ANLY-02**: Se emiten los eventos de ecommerce `view_item`, `add_to_cart`, `begin_checkout` y `purchase`
- [ ] **ANLY-03**: El evento `purchase` se emite una sola vez por pedido, sin duplicarse entre la pantalla de confirmación y el webhook

### Resiliencia e infraestructura

- [ ] **INFRA-01**: Un cron mantiene despierto el proyecto de Supabase tocando la base de verdad, no solo pingueando una ruta de Next
- [ ] **INFRA-02**: Si la base no responde, llega una alerta antes de que un cliente se encuentre el 500
- [ ] **INFRA-03**: Los errores de `/api/charge`, `/api/culqi/webhook` y `/api/reclamaciones` llegan a una herramienta de monitoreo, no solo a los logs de Vercel
- [ ] **INFRA-04**: La lógica de precio, envío e idempotencia de `/api/charge` tiene tests que fallan si alguien vuelve a confiar en el precio del cliente

### Higiene

- [ ] **CLEAN-01**: El sistema de puntos queda oculto de la web pública hasta que tenga persistencia real
- [ ] **CLEAN-02**: `lib/orders-store.ts` deja de escribir copias muertas en localStorage en cada checkout
- [ ] **CLEAN-03**: Los botones de "agregar pedido de prueba" del panel se eliminan y la llamada muerta a `updateOrderStatus` en `ValidarTab` desaparece
- [ ] **CLEAN-04**: `.context/DEPLOY.md` se actualiza: hoy sigue describiendo la limitación de pedidos-en-localStorage como vigente

## v2 Requirements

Reconocidos, fuera de este roadmap.

### Comprobante electrónico

- **SUNAT-01**: Emitir boleta electrónica por cada venta a consumidor final (evaluar DIY vs proveedor con API tipo Nubefact/Bsale, presentando el costo a Jaime)
- **SUNAT-02**: Guardar los datos fiscales del pedido para permitir el resumen diario de boletas

### Fidelización

- **LOYAL-01**: Migrar el sistema de puntos a Supabase con persistencia por cliente, no por dispositivo
- **LOYAL-02**: Vincular los puntos a los pedidos reales de la tabla `pedidos`

### Menú y catálogo

- **MENU-05**: CRUD completo del menú desde el panel (alta, baja, fotos, categorías)
- **MENU-06**: Modificadores estructurados con precio (extra queso +S/3), recalculados en el servidor

### Operación avanzada

- **OPS-09**: Pedido programado para una hora futura
- **OPS-10**: Tiempo estimado de entrega mostrado al cliente
- **OPS-11**: Información de alérgenos por producto
- **MKTG-01**: Captura de email antes del pago para recuperar carritos abandonados

## Out of Scope

| Feature | Reason |
|---------|--------|
| Boleta electrónica SUNAT en este milestone | Depende del contador de Jaime y de un gasto que él debe aprobar; se documenta como TODO con alternativas evaluadas |
| WhatsApp Cloud API para avisar a la cocina | Exige verificación de negocio de Meta y plantillas aprobadas; Telegram cubre lo mismo hoy, gratis y sin trámite |
| Modificadores con precio | La nota libre cubre el caso real; recalcular el total con opciones en el servidor no se justifica todavía |
| CRUD completo del menú | El panel edita solo precio y agotado en v1; el resto espera al backoffice/kanban |
| Migrar puntos a Supabase | No toca plata; se oculta ahora y se rehace después |
| Suite de tests completa del repo | No hay runner hoy; se cubre solo la lógica de `/api/charge`, que es la que mueve plata |
| Supabase Pro contratado ahora | El negocio no está invirtiendo; el cron keep-warm mitiga hasta que Jaime apruebe el gasto antes de pautar |
| RUC y razón social reales | Dato de Jaime, no de código; hoy salen como `[PENDIENTE]` en la constancia |

## Blockers externos

Bloquean requisitos concretos, no el milestone entero.

| Bloqueante | Bloquea | De quién |
|-----------|---------|----------|
| `RESEND_API_KEY` + correo del negocio | TRACK-03 | Jaime |
| Acceso a Meta Business / ID de Pixel + propiedad de GA4 | ANLY-01, ANLY-02 | Jaime |
| Estado de verificación de la cuenta Culqi (error `DNGA9999` en test) | PAY-01 | Culqi / Jaime |
| Precios reales de la carta | MENU-03 (carga inicial) | Jaime |
| Aprobación del gasto de Supabase Pro | Cierre definitivo de INFRA-01 | Jaime |
| Grupo de Telegram de la cocina + token del bot | OPS-05 | Jaime |

## Traceability

Actualizado durante la creación del roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (pendiente de roadmap) | — | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0
- Unmapped: 34 ⚠️

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after initial definition*
