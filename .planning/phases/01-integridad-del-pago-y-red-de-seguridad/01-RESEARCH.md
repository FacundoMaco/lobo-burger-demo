# Phase 1: Integridad del pago y red de seguridad - Research

**Researched:** 2026-08-25
**Domain:** Webhooks de pasarela de pago (Culqi), rate limiting serverless en Postgres, monitoreo de errores (Sentry), cron jobs en Vercel Hobby, TDD sobre un endpoint de cobro en producción (Next.js 16 + Vitest)
**Confidence:** MEDIUM-HIGH — todo lo verificable contra fuente primaria (docs.sentry.io, vercel.com/docs, node_modules/next/dist/docs, npm registry) quedó verificado con URL y fecha. Lo que Culqi no publica (payload del webhook, firma, reintentos) sigue sin poder verificarse — igual que ya lo dejó documentado `PITFALLS.md` — y el diseño recomendado es deliberadamente indiferente a esa falta de información.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Monitoreo y alertas**
- **D-01:** Sentry en su plan gratuito (5k errores/mes) es la herramienta de monitoreo. Se acepta el peso que suma al bundle a cambio de stack traces y agrupación de errores.
- **D-02:** No se crea un canal de alertas propio en esta fase. Las alertas salen por los canales del propio Sentry.
- **D-03:** ⚠ Riesgo abierto que la research debe cerrar: PAY-05 exige que "un humano se entere el mismo día", y el usuario dejó claro que nadie mira el correo durante el turno. Verificar qué canales de alerta admite realmente el plan gratuito de Sentry. Si solo admite email, esta decisión se reevalúa y se agrega un grupo de Telegram exclusivo de alertas — el código de envío a Telegram ya se necesita en Fase 3, así que el costo marginal es bajo.

**Rate limiting en `/api/charge`**
- **D-04:** El contador vive en una tabla de Supabase, no en Upstash Redis ni Vercel KV.
- **D-05:** Se limita por IP. Tradeoff explícito y aceptado: no detiene a un atacante que rota IPs. Los bounds existentes (`MIN_CENTS`/`MAX_CENTS`/`MAX_QTY`) quedan como reductor del daño por intento.
- **D-06:** Nunca un contador en memoria (`Map` a nivel de módulo).

**Webhook de Culqi**
- **D-07:** PAY-01 se resuelve de forma escalonada, antes de escribir una línea del handler: (1) abrir el checkout en vivo y el panel de Culqi para ver si Yape siquiera se ofrece y con qué objeto responde; (2) si eso no despeja, un pago real de S/3 con Yape en producción, reembolsado después.
- **D-08:** El handler trata el payload como un puntero, no como un hecho. Extrae el ID, llama a `GET https://api.culqi.com/v2/charges/{id}` con `CULQI_SECRET_KEY` server-side, y recién ahí escribe en `pedidos`.
- **D-09:** El webhook reusa el mismo patrón idempotente de `app/api/charge/route.ts:134-148` — `insert().select()`, capturar `23505`, en conflicto leer la fila existente. El webhook garantiza que la fila exista, no es dueño del estado.
- **D-10:** Cero lógica basada en tiempos de reintento de Culqi (no documentados, no verificables). `200` solo después de que la fila existe; no-2xx ante fallo genuino.
- **D-11:** El `matcher` de `proxy.ts` queda acotado a `/admin/:path*` y `/api/admin/:path*`. Si se amplía, excluir explícitamente `/api/culqi/webhook`.

**Reconciliación**
- **D-12:** Cron diario busca cargos en Culqi sin pedido correspondiente en Supabase y **alerta** — no crea el pedido automáticamente.
- **D-13:** La reconciliación es la red debajo del webhook, no un reemplazo. Sustituye a cualquier razonamiento sobre timeouts/reintentos.

**Keep-warm de Supabase**
- **D-14:** El cron ejecuta una query real (`select id from pedidos limit 1`), no un `200` de una ruta que no toca la base.
- **D-15:** El fallo del propio cron alerta (INFRA-02).
- **D-16:** Vercel Hobby limita cron a una ejecución diaria. El planner debería evaluar unificar keep-warm y reconciliación en un solo cron diario.

**Tests y metodología**
- **D-17:** Vitest como runner, configurado para poder sumar tests de componentes después sin rehacer la config.
- **D-18:** Cobertura obligatoria sobre `app/api/charge/route.ts`: recálculo del total, bounds, rama `23505`, rama de fallo de Supabase tras cargo exitoso.
- **D-23:** La fase se ejecuta con TDD. Cada tarea que produce lógica arranca con un test que falla, después el código, después el refactor.
- **D-24:** Levantar Vitest es la tarea 1 de la fase, no la última.
- **D-25:** Caracterizar antes de refactorizar: (1) tests contra el comportamiento actual del handler, (2) verlos pasar en verde sin tocar código, (3) recién ahí extraer. Un test de caracterización que falla antes de mover una línea es un hallazgo, no se arregla de paso.
- **D-26:** Qué es testeable:
  - **Unitario, sin red:** recálculo de precio, bounds, validación de email/teléfono (PAY-07), matemática de la ventana del rate limiter, armado del objeto de confirmación.
  - **Con Culqi y Supabase mockeados:** ramas del route handler y del webhook — idempotencia `23505`, fallo de insert tras cargo exitoso, re-fetch del cargo antes de escribir, carrera webhook vs `/api/charge`.
  - **No testeable automáticamente:** el contrato real del webhook de Culqi (lo resuelve D-07), que Sentry/Telegram efectivamente entreguen la alerta a un humano, que Vercel dispare el cron. Se verifican a mano y se documentan como verificación manual.

**Validación server-side**
- **D-19:** PAY-07 valida formato de email y teléfono en el servidor, replicando la validación del cliente (`app/checkout/page.tsx:56`).

**Limpieza**
- **D-20:** `lib/orders-store.ts` conserva los tipos `Order`/`OrderStatus` y una función que arma el objeto para la confirmación, **sin escribir en localStorage**.
- **D-21:** Eliminar los botones de "agregar pedido de prueba" (`app/admin/page.tsx:492-497` y `550-555`) y la llamada muerta a `updateOrderStatus` en `ValidarTab` (`app/admin/page.tsx:95`).
- **D-22:** Actualizar `.context/DEPLOY.md`.

### Claude's Discretion
- Esquema exacto de la tabla de rate limit (ventana deslizante vs contador por ventana fija, TTL/limpieza de filas viejas).
- Formato y contenido de los mensajes de alerta.
- Organización de los archivos de test y estrategia de mocking de Supabase/Culqi.
- Nombre y ubicación finales del helper que reemplaza a `saveOrder`.

### Deferred Ideas (OUT OF SCOPE)
- Frase "Te enviamos la constancia a tu correo" (`app/checkout/page.tsx:133`) — se deja viva, se cumple en Fase 4 con TRACK-03.
- Grupo de Telegram exclusivo de alertas técnicas — **esta research lo reactiva** (ver Resumen y Pitfall A); ya no está descartado.
- Upstash Redis / Vercel KV para el rate limiter — descartados a favor de la tabla en Supabase.
- CAPTCHA o nonce de sesión en `/api/charge` — fuera de alcance.
- Tests de la lógica de envío y de `lib/sedes.ts` — se escriben en Fase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descripción | Research Support |
|----|-------------|------------------|
| PAY-01 | Verificar con un pago real de Yape qué flujo de Culqi está activo antes de diseñar el webhook | Ver §Culqi webhook — flujo síncrono vs asíncrono (Pitfall 1 de `PITFALLS.md`); bloqueado externamente por verificación de cuenta Culqi (`DNGA9999`, CONCERNS.md #12) |
| PAY-02 | Pago confirmado por Culqi genera pedido aunque el navegador se cierre, vía webhook | Ver §Architecture Patterns — Webhook como puntero + re-fetch; §Código de ejemplo |
| PAY-03 | El webhook re-consulta el cargo contra la API de Culqi antes de escribir | Ver §Culqi `GET /v2/charges/{id}` |
| PAY-04 | Doble evento o carrera webhook vs `/api/charge` nunca duplica pedido ni cobro | Ver §Architecture Patterns — patrón de upsert idempotente reusado; §Validation — test determinista de la carrera |
| PAY-05 | Cargo exitoso con insert fallido dispara alerta que un humano ve el mismo día | Ver §Resumen — hallazgo bloqueante de Sentry; §Pitfall A |
| PAY-06 | `/api/charge` limita intentos por IP con contador que sobrevive entre invocaciones | Ver §Rate limiting en Postgres |
| PAY-07 | `/api/charge` valida formato de email y teléfono en servidor | Ver §Validación server-side |
| INFRA-01 | Cron mantiene despierto Supabase tocando la base real | Ver §Vercel Cron; reusa patrón D-14/D-16 |
| INFRA-02 | Alerta antes de que un cliente vea el 500 si la base no responde | Ver §Pitfall A — mismo canal que PAY-05 |
| INFRA-03 | Errores de `/api/charge`, `/api/culqi/webhook`, `/api/reclamaciones` llegan a monitoreo | Ver §Sentry en Next.js 16 — instrumentación server-only |
| INFRA-04 | Runner de tests que falla si alguien vuelve a confiar en el precio del cliente | Ver §Vitest — precondición de la fase (D-24); §Orden TDD |
| CLEAN-02 | `lib/orders-store.ts` deja de escribir en localStorage | Ver §Código existente — `lib/orders-store.ts`, `lib/cart-context.tsx:103-112` |
| CLEAN-03 | Eliminar botones de pedido de prueba y llamada muerta a `updateOrderStatus` | Ver código leído en `app/admin/page.tsx` — líneas confirmadas |
| CLEAN-04 | Actualizar `.context/DEPLOY.md` | Ver contenido actual leído — sección "Checklist pre-producción" ítem 4 está desactualizada |
</phase_requirements>

## Summary

**Hallazgo bloqueante resuelto (pregunta 1):** el plan gratuito (Developer) de Sentry **solo alerta por email**. Verificado dos veces contra `sentry.io/pricing` (fuente primaria, fetched 2026-08-25): la fila de la tabla de comparación dice literalmente "Alerts and notifications via email" para Developer, y "Alerts and notifications via integrated tools" (Slack, Discord, Teams, webhooks genéricos, PagerDuty) queda detrás del plan Team. El plan Developer además limita a **un usuario**. Esto activa exactamente el gatillo que D-03 dejó escrito: la decisión se reevalúa. **El código de envío a Telegram deja de ser exclusivo de Fase 3 y se construye en esta fase** como el canal real de "un humano se entera el mismo día" (PAY-05, INFRA-02), independiente del motor de alertas de Sentry. Sentry se mantiene (D-01 no se toca) pero pasa a cumplir un rol distinto: captura de stack traces para debugging, no el canal de alerta humana. Esto es una construcción nueva, no prevista en el `Deferred Ideas` original — la research la reactiva con evidencia.

**Segundo hallazgo, no bloqueante pero cambia la implementación:** INFRA-03 solo pide que los errores de tres rutas *servidor* (`/api/charge`, `/api/culqi/webhook`, `/api/reclamaciones`) lleguen a Sentry. Ninguna requisito de esta fase pide capturar errores del navegador. Next.js 16 separa la instrumentación de servidor (`instrumentation.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`) de la de cliente (`instrumentation-client.ts`, verificado contra `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`). Por lo tanto **no hace falta crear `instrumentation-client.ts` en esta fase** — el SDK de Sentry para navegador (~26 KB gzip solo la base, más si se agregan tracing/replay, [CITED: blog.sentry.io, marzo 2026, vía bundlephobia]) no se carga. Esto contradice parcialmente la premisa de D-01 ("se acepta el peso que suma al bundle") — en la práctica, para lo que pide esta fase, ese peso no aplica. Se documenta como hallazgo para que el planner y el usuario lo sepan; D-01 en sí (usar Sentry) no se toca.

**Tercer hallazgo:** Culqi no publica en ningún lugar accesible (ni `docs.culqi.com`, ni `apidocs.culqi.com` — este último es un SPA que no se pudo renderizar vía fetch de texto, ni fuentes de terceros encontradas) el payload exacto de sus webhooks, ni firma/HMAC, ni el esquema de reintentos. Esto ya estaba en `PITFALLS.md` (pitfalls 2 y 4) y sigue confirmado tras esta sesión de research adicional. El diseño de D-08/D-09/D-10 (tratar el payload como puntero, re-consultar, upsert idempotente, sin lógica de reintentos) es correcto precisamente porque es indiferente a esa falta de información — no hace falta resolverla para poder construir el webhook con seguridad.

**Primary recommendation:** levantar Vitest primero (D-24) con la config oficial de Next 16 (`vitest.config.mts` + `@vitejs/plugin-react` + `vite-tsconfig-paths`, entorno `jsdom` para compatibilidad futura con tests de componentes aunque esta fase no los necesite); escribir caracterización de `app/api/charge/route.ts` en verde antes de tocarlo (D-25); construir el rate limiter sobre una función de Postgres atómica (`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`) sin cron de limpieza aparte; construir el webhook y el cron como archivos nuevos que no tocan el handler existente (bajo riesgo de despliegue); y resolver PAY-05/INFRA-02 con un envío a Telegram vía `fetch` directo a la Bot API, sin SDK, siguiendo el mismo patrón "REST directo" que ya usa Culqi en este repo.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Webhook de Culqi (`app/api/culqi/webhook/route.ts`) | API / Backend | — | Ruta server-only, sin UI; debe quedar fuera del matcher de Basic Auth (D-11) |
| Re-fetch del cargo (`GET /v2/charges/{id}`) | API / Backend | — | Requiere `CULQI_SECRET_KEY`, nunca puede vivir en el cliente |
| Rate limiter de `/api/charge` | API / Backend | Database / Storage | La decisión (permitir/bloquear) se toma en la ruta; el estado atómico vive en una función de Postgres |
| Alerta a Telegram (PAY-05/INFRA-02) | API / Backend | — | Se dispara desde los mismos catch blocks server-side que hoy solo hacen `console.error` |
| Sentry — captura de errores | API / Backend | Edge (cron/proxy si aplica) | Solo `instrumentation.ts`/`sentry.server.config.ts`/`sentry.edge.config.ts`; sin cliente en esta fase |
| Cron keep-warm + reconciliación | API / Backend | Database / Storage | Ruta HTTP invocada por Vercel; ejecuta queries reales contra Supabase |
| Validación de email/teléfono (PAY-07) | API / Backend | Browser / Client | Ya existe en el cliente (`app/checkout/page.tsx:56`); esta fase agrega la ejecución server-side como autoridad final |
| `lib/orders-store.ts` (post D-20) | Browser / Client | — | Sigue siendo un helper de vista local (arma el objeto de confirmación), pero deja de persistir |
| Vitest / tests | — | — | No es un tier de runtime; corre en CI/local, no en producción |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest` | `^4.1.11` [VERIFIED: npm registry, `npm view vitest version`, 2026-08-25] | Test runner (D-17) | Es el runner que Next.js 16 documenta oficialmente para App Router (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, verificado en este repo) |
| `@vitejs/plugin-react` | `^6.1.0` [VERIFIED: npm registry] | Plugin de Vite/Vitest para JSX/TSX | Exigido por la guía oficial de Next.js para Vitest |
| `vite-tsconfig-paths` | `^6.1.1` [VERIFIED: npm registry] | Resuelve el alias `@/*` de `tsconfig.json` dentro de Vitest | Sin esto, `import { getMenuItem } from "@/lib/menu"` no resuelve en los tests — recomendado en la misma guía oficial |
| `jsdom` | `^30.0.1` [VERIFIED: npm registry] | Entorno DOM para Vitest | La guía oficial de Next.js lo usa como `environment: 'jsdom'` por defecto; esta fase no necesita DOM (los route handlers usan `Request`/`Response` nativos de Node 20, disponibles en cualquier entorno de Vitest) pero se instala ahora para que D-17 se cumpla sin reconfigurar cuando lleguen tests de componentes (Fase 3/4) |
| `@sentry/nextjs` | `^10.71.0` [VERIFIED: npm registry; peerDependencies confirma `next: "^13.2.0 \|\| ^14.0 \|\| ^15.0.0-rc.0 \|\| ^16.0.0-0"`, compatible con Next 16.2.9] | Monitoreo de errores server-side (D-01) | SDK oficial de Sentry para Next.js; instrumentación server-only en esta fase (ver Resumen) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` | `^16.3.2` [VERIFIED: npm registry] | Testing de componentes React | **No instalar en esta fase** — Phase 1 no tiene tests de componentes (solo route handlers y funciones puras). Instalar recién cuando una fase futura escriba el primer test de componente, para no cargar una dependencia sin uso |
| `@testing-library/dom` | `^10.4.1` [VERIFIED: npm registry] | Base de `@testing-library/react` | Mismo criterio que arriba |

Sin paquete nuevo para: rate limiting (usa `@supabase/supabase-js`, ya instalado), webhook (usa `fetch` nativo, igual que `app/api/charge/route.ts` con Culqi hoy), alerta a Telegram (usa `fetch` nativo contra `api.telegram.org`, sin SDK — mismo patrón "REST directo" que ya sigue este repo con Culqi), cron (es una ruta de Next + `vercel.json`, no una librería).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tabla de Postgres para rate limit | Upstash Redis (`@upstash/ratelimit`) | Descartado por decisión D-04: suma un servicio externo nuevo que no aporta nada que Supabase no resuelva ya a este volumen |
| Telegram Bot API vía `fetch` | `node-telegram-bot-api` (npm) | Innecesario: una sola llamada `POST https://api.telegram.org/bot<token>/sendMessage` no justifica una dependencia, y mantiene el mismo patrón "sin SDK" que ya usa el repo con Culqi |
| `@sentry/nextjs` con `withSentryConfig` (upload de source maps) | `@sentry/nextjs` sin envolver `next.config.ts` | `withSentryConfig` exige `SENTRY_AUTH_TOKEN` + slugs de org/project como secreto de CI para subir source maps — complejidad de build extra sin costo en dinero pero con costo operativo. Para el presupuesto de esta fase, alcanza con `Sentry.init()` directo en `sentry.server.config.ts`/`sentry.edge.config.ts` sin envolver `next.config.ts`; los stack traces llegan minificados pero funcionales. Documentado como recomendación, no como decisión cerrada — el planner puede optar por el wrapper completo si Jaime crea una cuenta de Sentry con org/project y no le importa el secreto extra en Vercel |

**Installation:**
```bash
npm install --save-dev vitest @vitejs/plugin-react vite-tsconfig-paths jsdom
npm install --save @sentry/nextjs
```

**Version verification:** confirmado contra el registro de npm el 2026-08-25 (`npm view <pkg> version`). Todas las versiones de la tabla Core están al día en ese momento; no se instaló nada en el repo, solo se consultó el registro.

## Package Legitimacy Audit

slopcheck instalado en esta sesión (`pip3 install slopcheck --break-system-packages`, versión 0.6.1) y ejecutado con `slopcheck scan <pkg> --pkg npm --json` contra cada paquete candidato.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|--------------|
| `vitest` | npm | ~4 años (creado 2021-12-03, [VERIFIED: `npm view vitest time.created`]) | Alto volumen, uno de los runners más usados del ecosistema Vite/Vitest | `github.com/vitest-dev/vitest` [VERIFIED] | `SUS` — flag `TYPOSQUAT_RISK`: "Suspiciously close to 'vite'" | **Aprobado — falso positivo.** `vitest` es el paquete de testing mantenido por el propio equipo de Vite, es el runner que la documentación oficial de Next.js recomienda (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`), y su antigüedad/repo confirman que no es un typosquat. El heurístico de slopcheck dispara por la subcadena "vite" dentro de "vitest", no por evidencia real de suplantación |
| `@vitejs/plugin-react` | npm | — | — | — | `OK` | Aprobado |
| `vite-tsconfig-paths` | npm | — | — | — | `OK` | Aprobado |
| `jsdom` | npm | — | — | — | `OK` | Aprobado |
| `@testing-library/react` | npm | — | — | — | `OK` | Aprobado (instalación diferida — ver Standard Stack) |
| `@testing-library/dom` | npm | — | — | — | `OK` | Aprobado (instalación diferida) |
| `@sentry/nextjs` | npm | — | — | — | `OK` | Aprobado |

Se verificó `scripts.postinstall` de los 7 paquetes vía `npm view <pkg> scripts.postinstall` — ninguno tiene postinstall script.

**Packages removed due to slopcheck [SLOP] verdict:** ninguno.
**Packages flagged as suspicious [SUS]:** `vitest` (ver justificación de falso positivo arriba; no requiere `checkpoint:human-verify` adicional dado que la evidencia de legitimidad es directa — repo oficial, antigüedad de 4 años, recomendado por la propia documentación de Next.js que ya vive en `node_modules` de este repo).

## Architecture Patterns

### System Architecture Diagram

```
Browser (Culqi Checkout Custom widget)
   │
   │ tokeniza tarjeta/Yape (culqi.token / culqi.order)
   ▼
POST /api/charge ────────────────────────────┐
   │ 1. valida formato email/teléfono (PAY-07)│
   │ 2. rate limit por IP (PAY-06) ───────────┤──► tabla rate_limit_charge (Postgres,
   │ 3. recalcula total contra lib/menu.ts    │       función atómica increment_rate_limit)
   │ 4. POST api.culqi.com/v2/charges         │
   │ 5. upsert idempotente en `pedidos`       │
   │    (23505 → lee fila existente)          │
   │ 6. si insert falla tras cobro exitoso:   │
   │    console.error + alertaTelegram() ─────┼──► api.telegram.org (fetch directo)
   └───────────────────────────────────────────┘
                                                        ▲
Culqi (servidor) ──── webhook POST ──► /api/culqi/webhook
   (evento charge.succeeded u order.status.changed,     │ 1. extrae SOLO el id del payload
    payload no documentado — se trata como puntero)     │    (payload = puntero, no hecho, D-08)
                                                          │ 2. GET api.culqi.com/v2/charges/{id}
                                                          │    con CULQI_SECRET_KEY
                                                          │ 3. upsert idempotente en `pedidos`
                                                          │    (mismo patrón 23505 que /api/charge,
                                                          │    nunca pisa campos ya escritos)
                                                          └──► tabla `pedidos` (misma que arriba)

Vercel Cron (1x/día, UTC, protegido con CRON_SECRET)
   └──► GET /api/cron/reconciliacion
         1. select id from pedidos limit 1 (keep-warm real, D-14)
            → si falla: alertaTelegram() + Sentry captureException (INFRA-02)
         2. lista cargos recientes en Culqi sin fila correspondiente en `pedidos`
            → si encuentra huérfanos: alertaTelegram() (D-12, no crea el pedido solo)

instrumentation.ts (Next 16, server + edge)
   └──► sentry.server.config.ts / sentry.edge.config.ts
         captura excepciones no manejadas de /api/charge, /api/culqi/webhook,
         /api/reclamaciones (INFRA-03) — SIN instrumentation-client.ts en esta fase
```

### Recommended Project Structure
```
app/
├── api/
│   ├── charge/route.ts              # existente, modificado: + rate limit, + validación PAY-07, + alertaTelegram()
│   ├── culqi/webhook/route.ts       # nuevo (PAY-02/03/04)
│   └── cron/
│       └── reconciliacion/route.ts  # nuevo, une keep-warm + reconciliación en una sola pasada (D-16)
lib/
├── culqi-verificar.ts               # nuevo: GET /v2/charges/{id} + helper de upsert idempotente reusado por charge y webhook
├── rate-limit.ts                    # nuevo: wrapper sobre la función de Postgres
├── alertas.ts                       # nuevo: alertaTelegram(mensaje), fetch directo, best-effort
├── validacion.ts                    # nuevo: validarEmail(), validarTelefono() — funciones puras (PAY-07)
├── orders-store.ts                  # modificado (D-20): pierde saveOrder()/localStorage, conserva tipos + un builder de vista local
supabase/migrations/
└── 20260825xxxxxx_rate_limit.sql    # nuevo: tabla + función atómica
instrumentation.ts                    # nuevo
sentry.server.config.ts               # nuevo
sentry.edge.config.ts                 # nuevo
vercel.json                           # nuevo (no existe hoy): declara el cron
vitest.config.mts                     # nuevo
app/api/charge/route.test.ts          # o __tests__/, co-ubicado — decisión de discreción (D-17 discretion)
```

### Pattern 1: Webhook como puntero, no como hecho (D-08/D-09/D-10)
**What:** el handler del webhook nunca confía en el body del POST. Extrae únicamente el identificador (probar `body.id`, y si no está, `body.data?.id` u otras formas anidadas comunes — el esquema exacto no está documentado, ver Assumptions Log A1), y re-consulta la verdad contra Culqi.
**When to use:** siempre que un proveedor de pagos no documente firma/HMAC verificable.
**Example:**
```typescript
// Source: patrón ya existente en este repo, app/api/charge/route.ts:116-148
// (D-09 exige reusar exactamente esta forma, no un insert nuevo)
export async function POST(request: Request) {
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) return new Response("No configurado", { status: 500 });

  let body: unknown;
  try { body = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }

  // El payload es un puntero: solo se usa para encontrar el id, nunca para
  // confiar en monto/estado. Culqi no documenta la forma exacta (ver
  // Assumptions Log A1) asi que se prueban las formas mas comunes.
  const chargeId = extraerChargeId(body); // helper propio, ver lib/culqi-verificar.ts
  if (!chargeId) return new Response("Sin id reconocible", { status: 400 });

  const res = await fetch(`https://api.culqi.com/v2/charges/${chargeId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) {
    // fallo genuino (Culqi caido, id invalido): no-2xx para que el
    // reintento de Culqi -- sea cual sea -- tenga oportunidad (D-10)
    return new Response("No se pudo verificar el cargo", { status: 502 });
  }
  const cargo = await res.json(); // amount, state, id -- la UNICA fuente de verdad

  // upsert idempotente identico al de app/api/charge/route.ts:134-148:
  // insert().select(), capturar 23505, leer fila existente en conflicto,
  // NUNCA pisar campos que /api/charge ya escribio.
  // ... (mismo bloque, ver lib/culqi-verificar.ts para el helper compartido)

  return new Response("OK", { status: 200 }); // solo despues de que la fila existe
}
```

### Pattern 2: Rate limiting atómico en Postgres, sin cron de limpieza aparte
**What:** una función de Postgres hace el incremento y la limpieza en la misma transacción, evitando condiciones de carrera entre invocaciones serverless concurrentes.
**When to use:** PAY-06, cuando D-04 descarta un store externo.
**Example:**
```sql
-- Source: patrón estándar de Postgres UPSERT atómico (MEDIUM confidence,
-- técnica bien establecida, no específica de Supabase; no viene de un doc
-- oficial de Supabase para este caso puntual)
create table rate_limit_charge (
  ip text not null,
  window_start timestamptz not null,
  intentos int not null default 1,
  primary key (ip, window_start)
);

create or replace function increment_rate_limit(
  p_ip text,
  p_window_start timestamptz,
  p_max_age interval default interval '1 hour'
) returns int
language plpgsql
as $$
declare
  v_count int;
begin
  -- limpieza oportunista en la misma llamada: sin cron aparte
  delete from rate_limit_charge where window_start < now() - p_max_age;

  insert into rate_limit_charge (ip, window_start, intentos)
  values (p_ip, p_window_start, 1)
  on conflict (ip, window_start) do update
    set intentos = rate_limit_charge.intentos + 1
  returning intentos into v_count;

  return v_count;
end;
$$;
```
```typescript
// lib/rate-limit.ts
export async function contarIntento(ip: string, windowMs: number): Promise<number> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .rpc("increment_rate_limit", { p_ip: ip, p_window_start: windowStart });
  if (error) throw error; // decision del planner: fail-open o fail-closed ante error de Supabase
  return data as number;
}
```
**Qué es unit-testeable (D-26):** la matemática de `windowStart` (función pura `calcularWindowStart(now, windowMs)`) y la decisión `debeBloquear(intentos, limite)` — ambas sin red. **Qué NO es unit-testeable:** la atomicidad real bajo concurrencia — eso solo lo garantiza Postgres, se verifica con una prueba de integración contra una base real o manualmente (dos invocaciones concurrentes desde procesos distintos), nunca con un mock.

### Pattern 3: Cron protegido con `CRON_SECRET`
**What:** Vercel manda automáticamente el valor de la env var `CRON_SECRET` como header `Authorization: Bearer <valor>` en cada invocación de cron. El handler solo tiene que comparar.
**Example:**
```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs (fetched 2026-08-25)
// app/api/cron/reconciliacion/route.ts
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... keep-warm + reconciliacion
}
```
```json
// vercel.json (no existe hoy en el repo)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/reconciliacion", "schedule": "0 9 * * *" }
  ]
}
```
**Nota de horario:** Vercel Cron corre siempre en **UTC**, sin excepción [CITED: vercel.com/docs/cron-jobs, "The timezone is always UTC", fetched 2026-08-25]. `0 9 * * *` = 09:00 UTC = 04:00 Lima (UTC-5, sin horario de verano) — un horario de bajo tráfico, deliberado. En Hobby, además, la ejecución puede caer en cualquier minuto dentro de esa hora (`08:00–08:59` según el ejemplo oficial), nunca al minuto exacto.
**Qué NO es testeable automáticamente:** que Vercel efectivamente dispare el cron — eso se verifica a mano en el dashboard de Vercel (D-26). Sí es testeable con Vitest: que el handler devuelve 401 sin el header correcto, y que llama a `getSupabaseAdmin()` cuando el header es válido (con Supabase mockeado).

### Anti-Patterns to Avoid
- **Confiar en el estado que reintenta el webhook de Culqi ("ya reintentó 3 veces, debe haber fallado"):** Culqi no documenta su política de reintentos en ningún lugar verificado. No construir lógica de negocio sobre un número que nadie puede confirmar (D-10, Pitfall 4 de `PITFALLS.md`).
- **Instalar `@upstash/ratelimit` "por si acaso":** contradice D-04 explícitamente.
- **Envolver `next.config.ts` con `withSentryConfig` sin que Jaime tenga cuenta/org de Sentry creada:** el wrapper pide `org`/`project` slugs; sin eso el build falla o sube source maps a un proyecto equivocado.
- **Usar `Sentry.captureMessage` como el único canal de alerta humana:** dado el hallazgo de la pregunta 1, esto silenciosamente no llega a nadie durante el turno.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Contador de intentos por IP compartido entre invocaciones serverless | `Map` en memoria a nivel de módulo | Función atómica de Postgres (`INSERT ... ON CONFLICT ... RETURNING`) | Cada invocación de Vercel puede caer en una instancia distinta; un `Map` en memoria no se comparte y da falsa sensación de protección (Pitfall 11 de `PITFALLS.md`, D-06) |
| Verificación de autenticidad del webhook | Un esquema propio de firma/token compartido con Culqi que Culqi no ofrece | Re-fetch server-side de `GET /v2/charges/{id}` | Culqi no publica ni firma ni secreto de webhook; inventar una verificación que Culqi no soporta del otro lado no verifica nada real |
| Notificación a un humano | Un dashboard de estado propio, polling, o confiar en que alguien revise Vercel Logs | `fetch` directo a la Bot API de Telegram desde los mismos catch blocks que ya existen | Cero infraestructura nueva: reusa el patrón "REST directo, sin SDK" que ya sigue este repo con Culqi |
| Test de la carrera webhook vs `/api/charge` | Levantar una base Postgres real en cada corrida de CI | Mockear `getSupabaseAdmin()` para simular dos llamadas a `insert()` donde la segunda devuelve un error `23505` sintético | La atomicidad real la garantiza Postgres, no el código de la app; el test de la app solo necesita probar que el código *reacciona* correctamente al error `23505`, no que Postgres lo genere |

**Key insight:** en los tres primeros casos, la tentación es "construir algo que se vea robusto" (un Map con TTL, una firma HMAC propia, un dashboard). Ninguno de los tres resuelve el problema real — comparten estado entre instancias serverless, o verifican contra un contrato que el otro lado no ofrece. La solución correcta en los tres casos es más simple que la tentación: una función de Postgres, un re-fetch, y una llamada `fetch` directa.

## Common Pitfalls

### Pitfall A: Confiar en que Sentry gratis alerta a un humano el mismo día
**What goes wrong:** el plan Developer de Sentry solo notifica por email (verificado, ver Resumen). En este negocio, "nadie mira el correo durante el turno" ya es un hecho declarado por el usuario en la discusión de contexto. Si PAY-05/INFRA-02 se implementan asumiendo que "Sentry alerta" sin más, la alerta técnicamente existe pero nadie la ve el mismo día — la métrica de éxito de la fase queda incumplida en silencio.
**Why it happens:** Sentry se percibe como "la" herramienta de alertas, y su UI de reglas de alerta (`Alerts` en el dashboard) no deja obvio en el flujo gratuito que las integraciones de chat están bloqueadas hasta que se intenta conectar Slack/Discord y aparece el paywall.
**How to avoid:** separar dos responsabilidades que D-01/D-02 fusionaban implícitamente: Sentry captura y agrupa errores (debugging), pero el disparo de la alerta humana (PAY-05/INFRA-02) se hace con una llamada directa a Telegram desde el mismo punto del código donde hoy solo hay `console.error` (`app/api/charge/route.ts:149,158`, y los catch de la ruta de cron). No depender del motor de alertas de Sentry para el requisito de "un humano se entera".
**Warning signs:** una tarea del plan que dice "configurar alert rule en Sentry para que avise" sin mencionar Telegram explícitamente; ausencia de una función `alertaTelegram()` o equivalente en `lib/`.

### Pitfall B: `withSentryConfig` como paso obligatorio
**What goes wrong:** seguir el wizard/guía estándar de Sentry lleva a envolver `next.config.ts` con `withSentryConfig(nextConfig, { org, project, ... })`, que requiere `SENTRY_AUTH_TOKEN` como secreto de build para subir source maps. Sin ese token configurado en Vercel, el build puede fallar o quedarse silenciosamente sin source maps.
**Why it happens:** es el camino que documenta Sentry por defecto (`docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup`, fetched 2026-08-25), optimizado para equipos con CI ya configurado, no para "gratis y sin fricción".
**How to avoid:** para esta fase, inicializar Sentry directo en `sentry.server.config.ts`/`sentry.edge.config.ts` con `Sentry.init({ dsn: ... })`, sin tocar `next.config.ts`. Los stack traces llegan sin desminificar pero el flujo de captura funciona igual. Si Jaime en el futuro crea una cuenta con org/project y no le molesta el secreto extra, se agrega `withSentryConfig` después sin romper nada de lo construido en esta fase.
**Warning signs:** un build que falla en Vercel pidiendo `SENTRY_AUTH_TOKEN` sin que nadie lo haya provisto.

### Pitfall C: Refactorizar `/api/charge` en el mismo deploy que agrega comportamiento nuevo
**What goes wrong:** D-25 ya identifica el riesgo de refactor sobre el camino del dinero. El riesgo concreto de despliegue es mezclar en un solo commit/deploy: (a) la extracción de funciones puras desde el handler existente, y (b) comportamiento nuevo (rate limit, validación, alertas). Si algo se rompe en producción, no queda claro si fue el refactor o la feature nueva, y el rollback de Vercel revierte ambos a la vez.
**Why it happens:** una vez que se están tocando las mismas líneas para extraer y para agregar, es tentador hacerlo en un solo paso "ya que estoy ahí".
**How to avoid:** separar en commits/deploys distintos: (1) tests de caracterización en verde, cero cambios de producción; (2) extracción de funciones puras, mismo comportamiento externo, tests de caracterización siguen en verde; (3) recién ahí, features nuevas (rate limit, validación, alertas) como cambios aditivos. Cada paso es revertible independientemente con Vercel Instant Rollback.
**Warning signs:** un PR/commit que toca `app/api/charge/route.ts` con diff simultáneo de líneas movidas Y líneas nuevas.

### Pitfall D: `fetch` mockeado de forma inconsistente entre entornos de Vitest
**What goes wrong:** al mockear las llamadas a `api.culqi.com` o `api.telegram.org` en los tests, usar un mock ambiental (reasignar `global.fetch` a mano) puede comportarse distinto según el entorno de Vitest (`node` vs `jsdom`) o filtrarse entre tests si no se limpia.
**Why it happens:** Node 20+ expone `fetch`/`Request`/`Response` como globals nativos; `jsdom` como entorno de test no los reemplaza, pero un mock manual mal limpiado entre tests (`afterEach`) puede dejar el mock de un test afectando al siguiente.
**How to avoid:** usar `vi.stubGlobal('fetch', vi.fn())` dentro de cada test o en un `beforeEach`, y `vi.unstubAllGlobals()` en `afterEach` — patrón estándar de Vitest para evitar fugas entre tests.
**Warning signs:** tests que pasan solos pero fallan al correr la suite completa, o que pasan en un orden y fallan en otro.

### Pitfall E: Cron duplicado o saltado no debe duplicar alertas ni pedidos
**What goes wrong:** Vercel documenta explícitamente que la entrega de cron es "best effort": puede invocar el mismo cron más de una vez, o saltarse una invocación por error transitorio de red, y **no reintenta automáticamente** [CITED: vercel.com/docs/cron-jobs/manage-cron-jobs, sección "Cron job delivery and idempotency", fetched 2026-08-25]. Si el handler de reconciliación no es idempotente, una doble invocación podría, en el peor caso, duplicar alertas (molesto, no grave) — el riesgo real seria mayor si el cron *escribiera* pedidos, pero D-12 ya prohíbe eso explícitamente.
**Why it happens:** se asume que "cron = corre una vez al día, punto", sin leer la letra chica de la garantía de entrega de Vercel.
**How to avoid:** diseñar el handler para que una doble invocación en el mismo día sea, en el peor caso, una alerta de Telegram duplicada (aceptable) — nunca una escritura duplicada en `pedidos` (ya cubierto porque D-12 prohíbe que el cron cree pedidos) ni un estado inconsistente. No se necesita deduplicación adicional para esta fase.
**Warning signs:** lógica en el cron que asume "esto corre exactamente una vez por día" para tomar una decisión irreversible.

## Code Examples

### Extracción defensiva del id en el webhook (dado que el payload no está documentado)
```typescript
// lib/culqi-verificar.ts
// Culqi no publica el esquema exacto del payload del webhook (verificado:
// docs.culqi.com/es/documentacion/pagos-online/webhooks/ solo documenta la
// configuracion en CulqiPanel, no el payload; apidocs.culqi.com es un SPA
// que no se pudo inspeccionar por fetch de texto). Se prueban las formas
// mas comunes de anidar un id; si ninguna aplica, se rechaza explicitamente
// en vez de asumir. PAY-01 (D-07) debe confirmar la forma real con un
// webhook real antes de que esto se de por definitivo -- ver Assumptions Log A1.
export function extraerChargeId(body: unknown): string | null {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.id === "string") return b.id;
    if (b.data && typeof (b.data as Record<string, unknown>).id === "string") {
      return (b.data as Record<string, unknown>).id as string;
    }
    if (b.object && typeof (b.object as Record<string, unknown>).id === "string") {
      return (b.object as Record<string, unknown>).id as string;
    }
  }
  return null;
}
```

### Alerta a Telegram, best-effort, sin SDK
```typescript
// lib/alertas.ts
// Mismo patron que Culqi en este repo: fetch directo, sin dependencia nueva.
// Best-effort: si Telegram falla, se loguea pero nunca rompe el flujo que
// la llamo (igual que Resend en app/api/reclamaciones/route.ts).
export async function alertaTelegram(mensaje: string): Promise<void> {
  const token = process.env.TELEGRAM_ALERT_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) {
    console.error("Alerta sin canal configurado:", mensaje);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje }),
    });
  } catch (e) {
    console.error("No se pudo enviar alerta a Telegram:", e);
  }
}
```

### Validación server-side de email y teléfono (PAY-07)
```typescript
// lib/validacion.ts — funciones puras, 100% unit-testeables sin red
// El regex de email replica exactamente app/checkout/page.tsx:56.
export function validarEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

// Celular peruano: 9 digitos, empieza con 9 (OSIPTEL reservo el prefijo 9
// para moviles desde 2008) [MEDIUM confidence: multiples fuentes de
// terceros coinciden -- Wikipedia, La Republica, Peru21 -- no se verifico
// contra el sitio de OSIPTEL directamente esta sesion]. Acepta prefijo
// +51/51 opcional y espacios/guiones, que se limpian antes de validar.
export function validarTelefono(telefono: string): boolean {
  const limpio = telefono.replace(/[\s-]/g, "");
  return /^(?:\+?51)?9\d{8}$/.test(limpio);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16.0.0 [CITED: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, tabla "Version history"] | Ya migrado en este repo (`proxy.ts` existe, `middleware.ts` no) — sin acción para esta fase, solo confirmar que el matcher sigue acotado (D-11) |
| Jest + `next/jest` | Vitest | Next.js documenta ambos, pero Vitest es la guía recomendada para App Router desde hace varias versiones [CITED: `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`] | D-17 ya elige Vitest, consistente con la doc oficial actual |
| `sentry.client.config.ts`/`sentry.server.config.ts` manuales sin `instrumentation.ts` | `instrumentation.ts` (`register()` + `onRequestError`) + `instrumentation-client.ts` | `onRequestError` estable desde Next 15.0.0; `instrumentation-client.ts` introducido en Next 15.3 [CITED: version history de ambos docs en `node_modules/next/dist/docs`] | El repo ya está en Next 16.2.9, así que esta es la única convención vigente — no hay necesidad de camino legacy |
| Middleware con frecuencia arbitraria en cron providers genéricos | Vercel Cron Hobby: máximo 1x/día, precisión "dentro de la hora" | Vigente en 2026 [CITED: vercel.com/docs/cron-jobs/usage-and-pricing, fetched 2026-08-25] | Confirma D-16: unificar keep-warm + reconciliación en un solo cron es no solo recomendable sino la única opción viable en Hobby si se quisiera más de una tarea diaria distinta |

**Deprecated/outdated:**
- `middleware.ts`: ya no existe como convención reconocida en Next 16; renombrado a `proxy.ts` (ya migrado en este repo).
- Cualquier expectativa de que Sentry gratuito soporta integraciones de terceros (Slack/Discord/webhooks): correcto hasta el plan Team, no en Developer — confirmado esta sesión, no es un dato de entrenamiento estático, es el estado actual del pricing (fetched 2026-08-25).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | Forma del campo id dentro del payload del webhook de Culqi (`body.id` / `body.data.id` / `body.object.id`) | Architecture Patterns — Pattern 1; Code Examples | Si Culqi anida el id de otra forma, `extraerChargeId()` devuelve `null` y el webhook rechaza el evento con 400 en vez de procesarlo — falla cerrado, no silenciosamente, pero PAY-02 no se cumple hasta ajustar el parseo con el payload real (que D-07 obtiene con el pago de prueba) |
| A2 | Regex de teléfono peruano (`^(?:\+?51)?9\d{8}$` tras limpiar espacios/guiones) | Code Examples — `validarTelefono` | Si algún cliente usa un formato no contemplado (p. ej. un fijo con código de área), PAY-07 lo rechazaría en el servidor aunque el cliente lo haya aceptado — validado contra fuentes de terceros (Wikipedia, prensa), no contra OSIPTEL directamente |
| A3 | Omitir `withSentryConfig`/source maps es una opción válida y suficiente para esta fase | Standard Stack — Alternatives Considered; Pitfall B | Si el planner asume que hace falta el wrapper completo y no provisiona `SENTRY_AUTH_TOKEN`, el build podría fallar; si se omite como acá se recomienda, los stack traces en Sentry llegan minificados (mayor esfuerzo de debugging, no un bloqueo funcional) |
| A4 | Reusar un solo bot de Telegram (con dos chats distintos) para las alertas técnicas de esta fase y el aviso a cocina de Fase 3, en vez de dos bots separados | Summary; Pitfall A | Bajo — es una decisión de discreción del planner/Jaime, no afecta la arquitectura del código (`alertaTelegram()` recibe `chatId` como parámetro/env var, agnóstico de cuántos bots existan) |
| A5 | `GET https://api.culqi.com/v2/charges/{id}` se autentica igual que `POST /v2/charges` (`Authorization: Bearer <CULQI_SECRET_KEY>`) | Architecture Patterns — Pattern 1 | Ya está en D-08 como decisión del usuario, y es consistente con el patrón REST estándar de Culqi visto en el POST existente (`app/api/charge/route.ts:89`); no se pudo confirmar contra la especificación Swagger de `apidocs.culqi.com` porque es un SPA que no renderiza vía fetch de texto — confirmar con una llamada real durante la verificación de PAY-01 |

**Si esta tabla está vacía:** no aplica — hay 5 supuestos, todos con mitigación ya incorporada en el diseño (fail-closed en A1, verificación en vivo prevista en A1/A5, discreción del planner en A3/A4).

## Open Questions

1. **¿Jaime puede crear el bot/grupo de Telegram de alertas AHORA (Fase 1), no en Fase 3?**
   - What we know: D-03 preveía esto como una posibilidad ("el código de envío a Telegram ya se necesita en Fase 3"), pero esta research confirma que el gatillo se activó — hace falta ya, no en Fase 3.
   - What's unclear: si esto introduce un nuevo bloqueo externo para PAY-05/INFRA-02 (que hoy no tienen bloqueo externo listado en `REQUIREMENTS.md`) o si se puede reusar cualquier bot/grupo temporal (p. ej. un grupo de Telegram del propio dev) hasta que Jaime provea el definitivo.
   - Recommendation: el planner debería tratar `TELEGRAM_ALERT_BOT_TOKEN`/`TELEGRAM_ALERT_CHAT_ID` con el mismo patrón de "falla cerrado pero no bloquea el resto" que ya usa el repo (`proxy.ts` con `ADMIN_USER`/`ADMIN_PASSWORD`, `app/api/reclamaciones/route.ts` con `RESEND_API_KEY`): si faltan las env vars, `alertaTelegram()` cae a `console.error` (igual que hoy) sin romper el request que la llamó, y se documenta como gap conocido hasta que Jaime entregue el bot.

2. **Forma exacta del payload del webhook de Culqi.**
   - What we know: no está documentada en `docs.culqi.com`, no se encontró en fuentes de terceros esta sesión (se intentó un artículo de Medium del propio equipo de Culqi sobre webhooks con Laravel, bloqueado por 403 al fetch).
   - What's unclear: si Culqi manda `{ id, type, ... }` plano, o `{ data: { id } }`, o algo distinto por completo.
   - Recommendation: durante el pago de prueba de PAY-01 (D-07), apuntar temporalmente el webhook de CulqiPanel a un endpoint de logging (puede ser el mismo `/api/culqi/webhook` con un `console.log(JSON.stringify(body))` antes de cualquier otra lógica) para capturar el payload real antes de finalizar el parseo.

3. **¿Alcanza `Authorization: Bearer <CULQI_SECRET_KEY>` para el `GET /v2/charges/{id}`?**
   - What we know: es el mismo header que usa el `POST /v2/charges` existente en este repo.
   - What's unclear: no se pudo confirmar contra la especificación completa de la API (SPA no renderizable).
   - Recommendation: un curl manual de un segundo durante la verificación de PAY-01 cierra la duda sin costo.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Runtime de toda la app y de Vitest | ✓ | v20.19.4 (confirmado en `STACK.md`/entorno local) — cumple el mínimo de `vitest` 4.x (Node ≥18) y `@sentry/nextjs` (`engines.node: >=18`) | — |
| Vercel Cron (Hobby) | INFRA-01, PAY-05/INFRA-02 (cron de reconciliación) | ✓ | 1 ejecución/día, precisión "dentro de la hora" [CITED: vercel.com/docs/cron-jobs/usage-and-pricing] | Ninguno necesario — el límite ya está diseñado dentro de la fase (D-16) |
| Supabase (proyecto free tier existente) | Rate limit table, `pedidos`, keep-warm | ✓ | Proyecto `Lobobuger.com` (`kkkdfciwwqbfkapgaoov`) ya en uso | — |
| Culqi API (`api.culqi.com`) | PAY-01 a PAY-04 | ✓ con reserva | Cuenta live ya cobra en producción; la cuenta de **test** devolvía `DNGA9999` a todos los cargos al 2026-08-12 (`.context/DEPLOY.md`, `CONCERNS.md` #12) — estado no confirmado en esta sesión, verificar contra el panel antes de PAY-01 | Ninguno — es un bloqueo externo ya documentado en `ROADMAP.md` ("PAY-01 depende de confirmar con Culqi el estado de verificación de la cuenta test") |
| Cuenta de Sentry | INFRA-03, y transitivamente PAY-05/INFRA-02 (captura de excepciones, no el canal de alerta) | ✗ | — | Ninguna cuenta creada hoy en el repo (`package.json` no tiene `@sentry/*`). Requiere que alguien (dev o Jaime) cree una cuenta gratuita y obtenga un DSN — acción externa de bajo costo, no bloquea el resto de la fase si se gatea con `if (!process.env.SENTRY_DSN) return` igual que los demás flags de config faltante en este repo |
| Bot de Telegram para alertas | PAY-05, INFRA-02 (canal humano real, ver Resumen) | ✗ | — | Bloqueo externo nuevo (ver Open Question 1) — se puede lanzar la fase con el helper `alertaTelegram()` construido y gateado por env var ausente (cae a `console.error`, patrón ya usado en el repo), y completarlo apenas Jaime entregue el bot |

**Missing dependencies with no fallback:** ninguna — todas las que faltan hoy (Sentry, Telegram) tienen un patrón de degradación ya usado en este repo (fail-safe con `console.error`, gateado por env var).

**Missing dependencies with fallback:** cuenta de Sentry, bot de Telegram — ver tabla arriba.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Autenticación | Parcial | No hay autenticación de usuario final en esta fase; el cron usa un secreto compartido (`CRON_SECRET`), no una sesión de usuario |
| V3 Gestión de sesión | No | Sin cambios de sesión en esta fase |
| V4 Control de acceso | Sí | `proxy.ts` Basic Auth sigue acotado a `/admin/:path*` y `/api/admin/:path*` (D-11); `/api/culqi/webhook` y `/api/cron/*` quedan deliberadamente fuera de ese matcher y usan su propio control (re-fetch a Culqi / `CRON_SECRET`) |
| V5 Validación de entrada | Sí | `validarEmail()`/`validarTelefono()` (PAY-07); bounds `MIN_CENTS`/`MAX_CENTS`/`MAX_QTY` ya existentes; el webhook nunca valida contra el body, solo contra la respuesta de `GET /v2/charges/{id}` |
| V6 Criptografía | Parcial | La comparación de `CRON_SECRET` en el ejemplo oficial de Vercel usa `!==` simple, no comparación en tiempo constante — riesgo de timing attack teóricamente presente pero de impacto bajo para este modelo de amenaza (negocio pequeño, no un objetivo de ataques de precisión de timing); mencionar como mejora opcional (`crypto.timingSafeEqual`), no como requisito de esta fase |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Payload de webhook falsificado (cualquiera que adivine la URL puede simular `charge.succeeded`) | Spoofing | Re-fetch server-side contra `GET /v2/charges/{id}` antes de escribir (D-08) — el atacante no puede fabricar una respuesta que Culqi nunca dio |
| Doble escritura de pedido (replay del webhook, o carrera con `/api/charge`) | Tampering | Upsert idempotente sobre `culqi_charge_id unique`, mismo patrón que ya existe (D-09) |
| Card testing / abuso de volumen contra `/api/charge` | Denial of Service | Rate limit por IP (PAY-06) + bounds `MIN_CENTS`/`MAX_CENTS`/`MAX_QTY` ya existentes — explícitamente reductor de volumen, no antifraude completo (D-05) |
| Invocación externa del endpoint de cron para forzar lecturas/alertas repetidas | Spoofing / Denial of Service | `CRON_SECRET` comparado contra el header `Authorization: Bearer` que Vercel manda automáticamente (Pattern 3) |
| Email/teléfono malformado llega a Culqi y a `pedidos.cliente_email` | Tampering (de datos, no de dinero) | `validarEmail()`/`validarTelefono()` server-side (PAY-07) |

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md` — leído directo del repo, confirma `register()`/`onRequestError`, estable desde Next 15.0.0
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md` — confirma que la instrumentación de cliente es un archivo separado y opcional
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — confirma convención `proxy.ts`, matcher, ejecución antes de las rutas
- `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` — guía oficial de Next.js para Vitest, versión leída directo del repo
- [sentry.io/pricing](https://sentry.io/pricing/) — fetched dos veces, 2026-08-25: Developer = "Alerts and notifications via email", "One user"; Team = "Alerts and notifications via integrated tools", "API & third-party integrations"
- [docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup) — fetched 2026-08-25, estructura de archivos (`instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `withSentryConfig`)
- [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — fetched 2026-08-25: límite Hobby = 1x/día, precisión "dentro de la hora"
- [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) — fetched 2026-08-25: formato de `vercel.json`, expresiones cron, zona horaria siempre UTC
- [vercel.com/docs/cron-jobs/manage-cron-jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — fetched 2026-08-25: protección con `CRON_SECRET`, entrega best-effort/idempotencia, sin reintento automático de Vercel
- `npm view <pkg> version` / `time.created` / `scripts.postinstall` / `repository.url` — ejecutado 2026-08-25 contra los 7 paquetes candidatos
- `docs.culqi.com/es/documentacion/pagos-online/webhooks/` — fetched 2026-08-25, confirma ausencia de firma/HMAC/payload/reintentos documentados (mismo hallazgo que `PITFALLS.md`)
- `docs.culqi.com/es/documentacion/pagos-online/cargo-unico/cargos/` — fetched 2026-08-25, confirma forma parcial de la respuesta de un cargo (`id`, `amount`, `state`, `response_code`)

### Secondary (MEDIUM confidence)
- Regex de teléfono peruano — cruzado contra Wikipedia ("Números telefónicos del Perú"), La República y Perú21, 2026-08-25 — no verificado contra OSIPTEL directamente
- Tamaño del bundle de `@sentry/nextjs` client (~26 KB gzip base v10) — vía búsqueda que cita blog.sentry.io (marzo 2026) y Bundlephobia
- Patrón de rate limiting atómico en Postgres (`INSERT ... ON CONFLICT ... RETURNING`) — técnica estándar de Postgres, no específica de un doc de Supabase para este caso puntual

### Tertiary (LOW confidence)
- Ninguna reclamada como autoritativa en este documento; donde la información no se pudo verificar (payload del webhook de Culqi, autenticación exacta del `GET /v2/charges/{id}`), se documentó explícitamente como no verificado en vez de rellenarse con una suposición sin marcar (ver Assumptions Log A1, A5)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas las versiones verificadas contra el registro de npm el mismo día, y el camino de Vitest/Sentry está tomado directamente de documentación oficial vigente
- Architecture (webhook, rate limit, cron): MEDIUM-HIGH — los patrones de idempotencia y cron están verificados contra fuente primaria; el esquema exacto del payload del webhook de Culqi sigue sin poder verificarse (limitación de la fuente, no de esta research)
- Pitfalls: HIGH — la mayoría surgen de verificación directa contra fuente primaria en esta sesión (Sentry pricing, Vercel cron delivery), no de conocimiento de entrenamiento

**Research date:** 2026-08-25
**Valid until:** 30 días para las decisiones de arquitectura (patrones estables); **7 días para el hallazgo de pricing de Sentry** — los planes gratuitos de SaaS cambian sin aviso, re-verificar `sentry.io/pricing` si la implementación de esta fase se retrasa más de una semana desde esta research.
