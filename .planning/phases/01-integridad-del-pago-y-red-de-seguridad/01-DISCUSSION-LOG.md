# Phase 1: Integridad del pago y red de seguridad - Discussion Log

> **Solo rastro de auditoría.** No usar como entrada de los agentes de research, planificación o ejecución.
> Las decisiones están en `01-CONTEXT.md` — este log preserva cómo se llegó a ellas.

**Fecha:** 2026-08-24
**Fase:** 01-integridad-del-pago-y-red-de-seguridad
**Modo:** discuss
**Áreas discutidas:** canal de alertas, herramienta de monitoreo, store del rate limiter, runner de tests, verificación del flujo Yape, reconciliación diaria, destino de `lib/orders-store.ts`

## Preguntas y respuestas

### Canal de alertas técnicas

**Opciones presentadas:** grupo de Telegram aparte solo de alertas / el mismo grupo de la cocina / email vía Resend / solo la herramienta de monitoreo con su propio canal.

**Elegido:** solo la herramienta de monitoreo (Sentry) con su propio email/alerta, sin canal propio.

**Nota de Claude:** se señaló al usuario que esto tensiona con PAY-05 ("un humano se entera el mismo día") dado que él mismo indicó que nadie mira el correo durante el turno. Quedó registrado como riesgo abierto (D-03) para que la research verifique qué canales admite el plan gratuito de Sentry.

### Herramienta de monitoreo

**Opciones presentadas:** Sentry free tier completo / logs estructurados + alerta propia / Sentry solo del lado servidor sin SDK en el cliente.

**Elegido:** Sentry free tier completo. El peso en el bundle se acepta a cambio de stack traces y agrupación.

### Store del rate limiter

**Opciones presentadas:** tabla en Supabase / Upstash Redis free / Vercel KV.

**Respuesta del usuario:** "utilizar lo que mejor nos convenga low to no cost" — delegó en la recomendación.

**Recomendación dada:** tabla en Supabase, con estas razones: no suma cuenta ni servicio externo; `/api/charge` ya depende de Supabase, así que no abre superficie de falla nueva; el volumen es de decenas de filas diarias; y los writes ayudan a mantener despierto el proyecto (INFRA-01). Se señaló que Upstash es lo estándar pero obliga a decidir el comportamiento cuando el propio limitador se cae en un endpoint de pago.

**Confirmado por el usuario:** sí, tabla en Supabase.

### Runner de tests

**Opciones presentadas:** `node:test` (cero dependencias) / Vitest / Vitest dejando lugar para tests de componentes.

**Elegido:** Vitest, configurado para poder sumar tests de componentes más adelante.

### PAY-01 — verificación del flujo Yape

**Contexto aportado por Claude:** `lib/culqi.ts:151-158` no pasa el parámetro `order` en `settings` y el callback (`lib/culqi.ts:190`) solo revisa `culqi.token`, nunca `culqi.order`. La doc de Culqi dice que `order` es requerido para que aparezca la opción Yape en Checkout Custom. O Yape no renderiza hoy, o la doc está desactualizada.

**Opciones presentadas:** pago real chico en producción con reembolso / revisar panel y checkout en vivo primero / escribir a soporte de Culqi para destrabar la cuenta test.

**Respuesta del usuario:** "si todo funciona ok".

**Interpretación aplicada (comunicada al usuario y sin objeción):** enfoque escalonado — primero panel y checkout en vivo, que es gratis y puede responder solo; si no despeja, pago real de S/3 con Yape y reembolso.

### Reconciliación diaria

**Opciones presentadas:** dentro de Fase 1 completa / fuera, el webhook y la alerta alcanzan / dentro pero mínima (solo detecta y alerta).

**Elegido:** dentro pero mínima — el cron detecta cargos sin pedido y alerta, no crea el pedido automáticamente.

### Destino de `lib/orders-store.ts`

**Respuesta inicial del usuario:** "debe haber alguna razón por la que está ahí, ya sea para que el carrito no muera al refrescar la página o yo qué sé, en todo caso revisar bien para qué se usa y evaluar si borrarlo o no."

**Investigación hecha:** se leyó `lib/orders-store.ts` completo y se rastrearon todos los llamadores.

| Función | Llamador | ¿Sirve? |
|---|---|---|
| `saveOrder()` | `lib/cart-context.tsx:104`, cada checkout real | El valor de retorno sí (arma el objeto para la confirmación y WhatsApp); la escritura a `lobo_orders` no la lee nadie |
| `saveOrder()` | `app/admin/page.tsx:42`, botón de prueba | No — escribe en una clave que el panel ya no lee |
| `getOrders()` | Solo `saveOrder` a sí mismo | No — muerto |
| `updateOrderStatus()` | `app/admin/page.tsx:95` | No — escribe en la clave muerta, no en `pedidos.estado` |
| tipos `Order`/`OrderStatus` | `app/checkout/page.tsx:10`, `app/admin/page.tsx:5` | Sí |

**Aclaración clave:** la supervivencia del carrito al refrescar **no** depende de este archivo. Vive en `lib/cart-context.tsx:44` bajo la clave `lobo_cart`.

**Elegido tras ver la evidencia:** conservar los tipos y una función que arma el objeto para la confirmación, sin escribir en localStorage.

### Hallazgo lateral — promesa de email inexistente

Revisando el checkout se encontró que la pantalla de confirmación dice "Te enviamos la constancia a tu correo" (`app/checkout/page.tsx:133`) y no se envía ningún email al pagar; Resend solo se usa en reclamaciones.

**Opciones presentadas:** sacar la frase ahora / sacarla ahora y cumplirla en Fase 4 / dejarla y cumplirla en Fase 4.

**Elegido:** dejarla y cumplirla en Fase 4 con TRACK-03, para no tocar el checkout en producción dos veces.

## Ideas diferidas

- Grupo de Telegram exclusivo de alertas técnicas — vuelve si la research demuestra que Sentry free solo alerta por email
- Upstash Redis / Vercel KV — descartados a favor de la tabla en Supabase
- CAPTCHA o nonce de sesión en `/api/charge` — fuera de alcance para el presupuesto actual
- Tests de la lógica de envío y de `lib/sedes.ts` — Fase 3, cuando exista el código

## A discreción de Claude

- Esquema de la tabla de rate limit (ventana deslizante vs fija, limpieza de filas viejas)
- Formato de los mensajes de alerta
- Organización de los tests y estrategia de mocking
- Nombre y ubicación del helper que reemplaza a `saveOrder`
