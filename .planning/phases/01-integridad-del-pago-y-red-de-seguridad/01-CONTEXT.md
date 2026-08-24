# Phase 1: Integridad del pago y red de seguridad - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Un pago confirmado por Culqi siempre se convierte en un pedido registrado en Supabase,
con alertas si algo falla, y el servidor resiste intentos de abuso o de manipular el
precio. Cubre PAY-01..07, INFRA-01..04 y CLEAN-02..04.

Fuera de esta fase: horario, agotados, delivery cobrado, aviso a cocina (Fase 3), menú
en Supabase (Fase 2), estado del pedido para el comprador (Fase 4), analítica (Fase 5).

</domain>

<decisions>
## Implementation Decisions

### Monitoreo y alertas

- **D-01:** Sentry en su plan gratuito (5k errores/mes) es la herramienta de monitoreo. Se acepta el peso que suma al bundle a cambio de stack traces y agrupación de errores.
- **D-02:** No se crea un canal de alertas propio en esta fase. Las alertas salen por los canales del propio Sentry.
- **D-03:** ⚠ **Riesgo abierto que la research debe cerrar:** PAY-05 exige que "un humano se entere el mismo día", y el usuario dejó claro que nadie mira el correo durante el turno. Verificar qué canales de alerta admite realmente el plan gratuito de Sentry (¿solo email? ¿webhooks?). Si solo admite email, esta decisión se reevalúa y se agrega un grupo de Telegram exclusivo de alertas — el código de envío a Telegram ya se necesita en Fase 3, así que el costo marginal es bajo.

### Rate limiting en `/api/charge`

- **D-04:** El contador vive en una tabla de Supabase, no en Upstash Redis ni Vercel KV. Razones: no suma cuenta ni servicio externo nuevo; `/api/charge` ya depende de Supabase para el insert, así que no abre una superficie de falla nueva (si Supabase está caído el cobro ya está degradado); el volumen es de decenas de filas por día, despreciable en free tier; y los writes ayudan a mantener el proyecto despierto, que es justo el problema de INFRA-01.
- **D-05:** Se limita por IP. Tradeoff explícito y aceptado: el límite por IP no detiene a un atacante que rota IPs. Los bounds ya existentes (`MIN_CENTS`/`MAX_CENTS`/`MAX_QTY`, `app/api/charge/route.ts:10-12`) quedan como reductor del daño por intento. El rate limiting es un reductor de volumen, no una solución antifraude completa.
- **D-06:** Nunca un contador en memoria (`Map` a nivel de módulo). En Vercel serverless cada invocación puede caer en una instancia distinta y el límite no se comparte — parece que funciona en review y no hace nada bajo carga real.

### Webhook de Culqi

- **D-07:** PAY-01 se resuelve de forma escalonada, antes de escribir una línea del handler: (1) abrir el checkout en vivo y el panel de Culqi para ver si Yape siquiera se ofrece y con qué objeto responde; (2) si eso no despeja, un pago real de S/3 (el mínimo de Culqi) con Yape en producción, reembolsado después. El diseño del webhook no arranca hasta saber si el flujo vivo es token síncrono (`chr_...`, evento `charge.succeeded`) u orden asíncrona (`ord_...`, evento `order.status.changed`).
- **D-08:** El handler trata el payload como un puntero, no como un hecho. Extrae el ID, llama a `GET https://api.culqi.com/v2/charges/{id}` con `CULQI_SECRET_KEY` server-side, y recién ahí escribe en `pedidos`. Culqi no documenta firma HMAC — el re-fetch cierra la pregunta de confianza sin depender de eso.
- **D-09:** El webhook reusa el mismo patrón idempotente que ya existe en `app/api/charge/route.ts:134-148` — `insert().select()`, capturar `23505`, y en conflicto leer la fila existente en vez de fallar. El trabajo del webhook es **garantizar que la fila exista**, no ser dueño del estado del pedido: no pisa campos que el camino síncrono ya escribió.
- **D-10:** Cero lógica basada en los tiempos de reintento de Culqi. Esos números no están documentados y los que circulan no se pudieron verificar. El handler devuelve `200` solo después de que la fila existe, y un no-2xx ante un fallo genuino (Supabase caído) para que el reintento de Culqi — sea cual sea — tenga oportunidad de recuperar.
- **D-11:** El `matcher` de `proxy.ts` queda acotado a `/admin/:path*` y `/api/admin/:path*`. Si alguna vez se amplía a `/api/:path*`, hay que excluir explícitamente `/api/culqi/webhook` — Culqi no puede autenticarse como un navegador y el webhook fallaría en silencio para siempre.

### Reconciliación

- **D-12:** Un cron diario busca cargos en Culqi sin pedido correspondiente en Supabase y **alerta**. No crea el pedido automáticamente — detecta y avisa, la decisión queda en manos de un humano.
- **D-13:** La reconciliación es la red debajo del webhook, no un reemplazo. Sustituye a cualquier razonamiento sobre timeouts o reintentos (ver D-10).

### Keep-warm de Supabase

- **D-14:** El cron ejecuta una query real contra Supabase (por ejemplo `select id from pedidos limit 1`), no un `200` de una ruta de Next. Supabase mide inactividad por queries que llegan al proyecto; un health-check que devuelve 200 sin tocar la base deja pausar el proyecto igual mientras el cron "siempre funciona".
- **D-15:** El fallo del propio cron alerta (INFRA-02). Un keep-warm que falla en silencio es una cosa más que parece hecha sin hacer lo único para lo que existe.
- **D-16:** Vercel Hobby limita los cron a una ejecución diaria. Los dos crons de esta fase (keep-warm y reconciliación) se diseñan para esa frecuencia. El planner debería evaluar unificarlos en un solo cron diario que toque la base y reconcilie en la misma pasada.

### Tests

- **D-17:** Vitest como runner, configurado de forma que después se puedan sumar tests de componentes sin rehacer la config.
- **D-18:** Cobertura obligatoria de esta fase sobre `app/api/charge/route.ts`: recálculo del total contra la carta, bounds `MIN_CENTS`/`MAX_CENTS`/`MAX_QTY`, la rama de idempotencia `23505`, y la rama de fallo de Supabase después de un cargo exitoso. La lógica de envío todavía no existe (llega en Fase 3) — ese test se escribe cuando exista, no ahora.

### Validación server-side

- **D-19:** PAY-07 valida formato de email y teléfono en el servidor, replicando la validación que hoy solo vive en el cliente (`app/checkout/page.tsx:56`). Hoy el route solo verifica presencia y tipo (`app/api/charge/route.ts:46-55`), así que un email malformado llega a Culqi y a la columna `cliente_email`.

### Limpieza

- **D-20:** `lib/orders-store.ts` conserva los tipos `Order`/`OrderStatus` y una función que arma el objeto para la pantalla de confirmación, **sin escribir en localStorage**. Se verificó que la persistencia es genuinamente muerta y que la supervivencia del carrito al refrescar no depende de este archivo (vive en `lib/cart-context.tsx:44`, clave `lobo_cart`, otra clave y otro archivo).
- **D-21:** Eliminar los botones de "agregar pedido de prueba" del panel (`app/admin/page.tsx:492-497` y `550-555`) y la llamada muerta a `updateOrderStatus` en `ValidarTab` (`app/admin/page.tsx:95`) — escribe en una clave que el panel ya no lee, no en `pedidos.estado`.
- **D-22:** Actualizar `.context/DEPLOY.md`, que todavía describe la limitación de pedidos-en-localStorage como vigente y da por buena una nota sobre Culqi que ya no se puede confiar.

### Claude's Discretion

- Esquema exacto de la tabla de rate limit (ventana deslizante vs contador por ventana fija, TTL/limpieza de filas viejas).
- Formato y contenido de los mensajes de alerta.
- Organización de los archivos de test y estrategia de mocking de Supabase/Culqi.
- Nombre y ubicación finales del helper que reemplaza a `saveOrder`.

</decisions>

<specifics>
## Specific Ideas

- **Sobre el presupuesto:** el negocio no está invirtiendo. Toda solución de esta fase debe caber en free tier. Lo que cueste dinero se le presenta a Jaime como decisión suya, no se asume.
- **Hallazgo durante la discusión, no resuelto en esta fase:** la pantalla de confirmación promete *"Te enviamos la constancia a tu correo"* (`app/checkout/page.tsx:133`) y hoy no se manda ningún email al pagar — Resend solo se usa en reclamaciones. Decisión tomada: **dejar la frase y cumplirla en Fase 4 con TRACK-03**, para no tocar el checkout en producción dos veces. Queda registrado que la promesa está viva y falsa mientras tanto.
- **Verificado durante la discusión:** `app/checkout/page.tsx:95` hace `setConfirmedOrder({ ...order, id: result.codigo })` — el `id` local que genera `saveOrder` se descarta y se pisa con el `codigo` del servidor. No hay bug de identidad ahí; el único valor vivo del helper es la *forma* del objeto.

</specifics>

<canonical_refs>
## Canonical References

**Los agentes downstream DEBEN leer esto antes de planificar o implementar.**

### Contexto del proyecto y alcance
- `.planning/PROJECT.md` — decisiones ya cerradas, restricciones (free tier, producción con plata real), qué quedó fuera de alcance y por qué
- `.planning/REQUIREMENTS.md` — los 38 requirements v1, la tabla de blockers externos de Jaime, y la traceability por fase
- `.planning/ROADMAP.md` §Phase 1 — objetivo, criterios de éxito y el bloqueo externo de PAY-01

### Riesgos y errores conocidos
- `.planning/research/PITFALLS.md` — 13 fallas documentadas. Para esta fase son críticas la 1 (flujo Yape equivocado), 2 (confiar en el payload), 3 (carrera webhook vs `/api/charge`), 4 (asumir reintentos), 11 (limitador en memoria), 13 (keep-warm que no toca la base)
- `.planning/codebase/CONCERNS.md` — items 1, 2, 3, 4, 7 y 8 son exactamente el alcance de esta fase, con evidencia línea por línea
- `.context/INVESTIGACION-PEDIDOS-ONLINE.md` §1.3, §1.4, §3.3, §3.4 — la auditoría original que originó estos requisitos

### Convenciones del código
- `AGENTS.md` — **obligatorio**: Next.js 16.2.9 tiene breaking changes; leer `node_modules/next/dist/docs/` antes de escribir código. `middleware.ts` no existe, es `proxy.ts`
- `.planning/codebase/CONVENTIONS.md` — estilo del código existente (comentarios en español sin tildes, nombres, estructura)
- `.planning/codebase/STACK.md` — versiones exactas y variables de entorno requeridas

### Documentación externa de Culqi
- https://docs.culqi.com/es/documentacion/pagos-online/webhooks/ — configuración de webhooks. **No documenta payload, firma ni reintentos** — verificado directamente
- https://docs.culqi.com/es/documentacion/pagos-online/cargo-unico/tokens-yape — flujo Yape síncrono por token (`chr_...`)
- https://docs.culqi.com/es/documentacion/pagos-online/ordenes-de-pago/resumen/ — flujo asíncrono por orden (`ord_...`), webhook `order.status.changed` marcado obligatorio
- https://docs.culqi.com/es/documentacion/checkout/checkout-custom — dice que el parámetro `order` es requerido para que aparezca la opción Yape

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Patrón de upsert idempotente** (`app/api/charge/route.ts:116-148`): `insert().select().single()`, capturar `error.code === "23505"`, leer la fila existente y devolverla. El webhook debe reusar exactamente esta forma, no escribir un insert nuevo.
- **`getSupabaseAdmin()`** (`lib/supabase.ts:12-22`): cliente server-only con service role. Lo usan `/api/charge`, `/api/reclamaciones` y `/api/admin/pedidos`. El keep-warm y el rate limiter lo reusan.
- **Constraint `culqi_charge_id text not null unique`** (`supabase/migrations/20260820000000_pedidos.sql:5`): ya es el punto de anclaje de la idempotencia. El webhook escribe contra la misma llave.
- **Bounds de sanidad** (`app/api/charge/route.ts:10-12`): `MIN_CENTS=300`, `MAX_CENTS=50000`, `MAX_QTY=20`. Ya limitan el daño por intento; el rate limiting los complementa, no los reemplaza.
- **Resend** (`resend` 6.20.0, usado en `app/api/reclamaciones/route.ts`): ya instalado y configurado, si alguna vez hace falta un canal de alerta por email.

### Established Patterns

- **Comentarios en español, sin tildes, explicando el porqué** — `app/api/charge/route.ts:1-5` y `:110-113` documentan tradeoffs deliberados. El código nuevo debe seguir ese registro.
- **Fallar cerrado ante configuración faltante** — `proxy.ts:14-16` devuelve 503 si faltan `ADMIN_USER`/`ADMIN_PASSWORD`; `app/api/charge/route.ts:33-35` devuelve 500 si falta `CULQI_SECRET_KEY`. El webhook y los crons deben hacer lo mismo con sus propias variables.
- **El realm de Basic Auth debe ser ASCII puro** (`proxy.ts:28-33`): las cabeceras HTTP son ByteString latin1; una tilde ahí tira un 500 en vez de pedir credenciales.
- **Sin tests en todo el repo** — no hay runner ni un solo `*.test.*`. Esta fase establece el primero.

### Integration Points

- **`app/api/culqi/webhook/route.ts`** — no existe. Ruta nueva, debe quedar fuera del `matcher` de `proxy.ts`.
- **`app/api/charge/route.ts`** — se le agrega el rate limit (antes del fetch a Culqi), la validación de formato de PAY-07, y la alerta a Sentry en las ramas de `console.error` de las líneas 149 y 158.
- **Rutas de cron** — nuevas, bajo `app/api/cron/`. Necesitan `vercel.json` (hoy no existe) para declarar el schedule, y protección para que no las pueda disparar cualquiera.
- **`lib/cart-context.tsx:103-112`** y **`app/checkout/page.tsx:85-95`** — consumidores del helper que reemplaza a `saveOrder`. La firma que devuelve debe seguir sirviendo para `buildWhatsAppUrl` (`lib/cart-context.tsx:37-42`).
- **`codigoPedido()`** (`app/api/charge/route.ts:28-30`) — genera `LB-${Date.now().toString(36)}`, de baja entropía. Esta fase **no** lo toca; el token público no adivinable es TRACK-01, en Fase 4. Anotado acá para que nadie lo dé por seguro mientras tanto.

</code_context>

<deferred>
## Deferred Ideas

- **Frase "Te enviamos la constancia a tu correo"** (`app/checkout/page.tsx:133`) — se deja viva y se cumple en Fase 4 con TRACK-03, para no tocar el checkout en producción dos veces. Decisión explícita del usuario.
- **Grupo de Telegram exclusivo de alertas técnicas** — descartado en esta fase a favor de las alertas nativas de Sentry. Vuelve a la mesa si la research demuestra que el plan gratuito solo alerta por email (ver D-03).
- **Upstash Redis / Vercel KV para el rate limiter** — descartados a favor de la tabla en Supabase. Reconsiderar solo si el volumen crece lo suficiente como para que los writes molesten, o si se contrata Supabase Pro.
- **CAPTCHA o nonce de sesión en `/api/charge`** — mencionado en CONCERNS.md item 3 como opción. Fuera de alcance: el rate limiting por IP más los bounds existentes son el tradeoff aceptado para el presupuesto actual. Escalar solo si se observa abuso real.
- **Tests de la lógica de envío y de `lib/sedes.ts`** — no existen todavía; se escriben en Fase 3 cuando exista el código que prueban.

</deferred>

---

*Phase: 01-integridad-del-pago-y-red-de-seguridad*
*Context gathered: 2026-08-24*
