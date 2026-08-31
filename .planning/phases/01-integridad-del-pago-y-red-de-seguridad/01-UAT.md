---
status: testing
phase: 01-integridad-del-pago-y-red-de-seguridad
source: 01-01-SUMMARY.md, 01-02-SUMMARY-PARCIAL.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md, 01-07-SUMMARY.md, 01-08-SUMMARY.md
started: 2026-08-31T11:50:00-05:00
updated: 2026-08-31T12:25:00-05:00
---

## Current Test

number: 8
name: Release deliberado a produccion
expected: |
  El branch de la Fase 1 (78 commits por delante de origin/main) se despliega a
  produccion en el orden obligatorio: migraciones -> CRON_SECRET en Vercel ->
  deploy. loboburger.com sigue cobrando sin romperse tras el deploy.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Matar dev server, `npm run dev` desde cero, abrir la home. La carta carga con fotos y precios, el checkout carga, los endpoints responden.
result: pass
nota: Auto-verificado. `.next` borrado, server fresco (ready en 362ms). `GET /` 200 con 16 precios renderizados, `GET /checkout` 200, `GET /api/cron/reconciliacion` 401 (falla cerrado sin CRON_SECRET), `POST /api/culqi/webhook` 400 "Payload sin id reconocible".

### 2. Red de seguridad automatizada (tests + build)
expected: `npm run test:run` da 126/126 en verde y `npm run build` compila con las rutas dinamicas correctas.
result: pass
nota: Auto-verificado. 13 archivos / 126 tests en verde (1.22s). `npm run build` limpio; `/api/charge`, `/api/culqi/webhook`, `/api/cron/reconciliacion` y `/api/admin/pedidos` aparecen como dinamicas (ƒ), proxy activo.

### 3. Migraciones aplicadas en Supabase
expected: Existen `pedidos`, `rate_limit_charge` y la funcion `increment_rate_limit`. Las dos migraciones del repo estan aplicadas.
result: pass
nota: |
  Al primer intento FALLO: `rate_limit_charge` -> PGRST205 y `increment_rate_limit` -> PGRST202
  contra el proyecto kkkdfciwwqbfkapgaoov. El usuario aplico 20260825000000_rate_limit.sql
  desde el SQL Editor del dashboard y se reverifico: tabla -> 200 [], RPC -> 200 devolviendo 1.
  `pedidos` ya estaba aplicada.

  Nota de entorno (no es un bug del producto): `db.kkkdfciwwqbfkapgaoov.supabase.co` resuelve
  SOLO a IPv6 y esta red no tiene IPv6, por lo que el MCP de Supabase y
  `supabase migration list`/`db push` timeoutean desde esta maquina. El pooler IPv4
  (`aws-0-us-west-1.pooler.supabase.com:6543`) si es alcanzable, y PostgREST sobre HTTPS
  funciona normal. Para futuras migraciones: SQL Editor o `--db-url` apuntando al pooler.

### 4. Rate limit real (PAY-06)
expected: 11 intentos seguidos de POST a `/api/charge` desde la misma IP: el 11 devuelve 429 y no llega ninguna llamada a Culqi.
result: pass
nota: |
  Auto-verificado en vivo contra el dev server con Supabase de produccion.
  12 POST consecutivos con `x-forwarded-for: 198.51.100.42, 10.0.0.1`:
  requests 1-10 -> 400 (rebotan en validacion de email, nunca llegan a Culqi),
  request 11 y 12 -> 429 "Demasiados intentos. Espera unos minutos antes de volver a
  intentar." (mensaje sin ningun digito, no revela el limite). Cero alertas de fail-open
  en el log (`grep -c "quedo ciego"` -> 0), o sea el limiter cuenta de verdad.

  Semantica del RPC verificada por separado con la ventana actual alineada a la hora:
  5 llamadas seguidas devuelven 1,2,3,4,5; una IP distinta arranca en 1; la limpieza
  oportunista (`window_start < now() - 1 hour`) borra ventanas viejas.

  ATOMICIDAD BAJO CONCURRENCIA (paso 2 del checklist manual, cerrado):
  30 llamadas al RPC en paralelo desde la misma IP+ventana -> contador final exactamente 30.
  Cero updates perdidos. El `on conflict do update` de Postgres aguanta el escenario de
  dos invocaciones serverless simultaneas.

  Filas de prueba borradas al terminar; `rate_limit_charge` quedo vacia.

### 5. Validacion server-side de email y telefono (PAY-07)
expected: POST a `/api/charge` con email o telefono malformado devuelve 400 con mensaje especifico en espanol, ANTES del fetch a Culqi.
result: pass
nota: Auto-verificado en vivo. email `hola@` -> 400 "El correo no tiene un formato válido"; phone `12345` -> 400 "El teléfono debe tener 9 dígitos y empezar en 9"; qty 999 -> 400 "Cantidad no permitida"; id inexistente -> 400 "Hay un producto que ya no está disponible". Ningun request llego a Culqi.

### 6. Panel admin limpio (CLEAN-03)
expected: En `/admin` ya no aparecen los botones "Agregar pedido de prueba" y el estado vacio dice "Los pedidos pagados en la web aparecen aqui".
result: pass
nota: Auto-verificado por codigo. `grep -c "generateMockOrder|MOCK_NAMES|Agregar pedido de prueba" app/admin/page.tsx` -> 0. Texto del estado vacio en la linea 466: "Aun no hay pedidos. Los pedidos pagados en la web aparecen aqui." `/api/admin/pedidos` responde 200 detras del Basic Auth del proxy.

### 7. Checkout ya no escribe pedidos en localStorage (CLEAN-02)
expected: La clave `lobo_orders` ya no se escribe. El carrito (`lobo_cart`) sigue persistiendo y el link de WhatsApp se sigue armando.
result: pass
nota: Auto-verificado por codigo. `grep -rn "lobo_orders" app/ lib/ components/` -> cero coincidencias. `lib/orders-store.ts` expone solo `construirOrderLocal` (sin `setItem`), con el comentario que documenta por que la falta de persistencia local es deliberada.

### 8. Release deliberado a produccion
expected: El branch de la Fase 1 (78 commits por delante de origin/main) se despliega a produccion en el orden obligatorio: migraciones (ya aplicadas) -> `CRON_SECRET` en Vercel -> deploy. loboburger.com sigue cobrando sin romperse tras el deploy.
result: pass
nota: |
  Desplegado 2026-08-31. main: 8d6d0ef -> 80a92c6 (fast-forward).
  Unico conflicto del merge: app/api/culqi/webhook/route.ts (add/add) — main tenia
  el endpoint temporal de 01-02 (30 lineas), la branch el definitivo de 01-07
  (196 lineas). Resuelto tomando el definitivo. 126/126 tests, tsc y build limpios
  sobre el resultado del merge ANTES de pushear.

  Env vars cargadas por el usuario antes del deploy: CRON_SECRET, ADMIN_USER,
  ADMIN_PASSWORD. Verificado en vivo contra loboburger.com:

  | endpoint                        | antes | despues |
  |---------------------------------|-------|---------|
  | GET /admin (sin auth)           | 200   | 401     |
  | GET /admin (credenciales ok)    | 200   | 200     |
  | GET /admin (clave incorrecta)   | 200   | 401     |
  | GET /api/admin/pedidos (auth)   | 404   | 200 {"pedidos":[]} |
  | POST /api/culqi/webhook {}      | 200 "OK" (temporal) | 400 "Payload sin id reconocible" (definitivo) |
  | GET /api/cron/reconciliacion    | 404   | 401 |
  | home / checkout                 | 200   | 200 |

  401 y no 503 en /admin confirma que ADMIN_USER/ADMIN_PASSWORD estan cargadas.
  /api/charge nuevo confirmado vivo: email malformado -> 400 "El correo no tiene un
  formato válido" (el handler viejo habria dicho "Datos de pago inválidos");
  qty 999 -> 400 "Cantidad no permitida". Los tres agujeros de produccion cerrados.

estado_produccion_previo_al_deploy: |
  Sondeo en vivo contra loboburger.com + lectura del codigo de main (8d6d0ef).
  Produccion sirve main, NO la branch de la Fase 1. Los tres agujeros siguen abiertos:

  1. GET /admin -> 200 SIN autenticacion. `proxy.ts` no existe en main
     (`git show 8d6d0ef:proxy.ts` -> no existe). El panel es publico hoy.
  2. /api/charge de main toma `amount` del body del cliente y se lo pasa tal cual
     a api.culqi.com. Se puede pagar S/3 un pedido de S/38.
  3. Ese handler no inserta en `pedidos` — solo devuelve `{chargeId}`. Los pedidos
     no se persisten del lado del servidor.

  Otros: /api/admin/pedidos -> 404, /api/cron/reconciliacion -> 404,
  /api/culqi/webhook -> 200 "OK" (el endpoint TEMPORAL de captura del plan 01-02;
  el definitivo devolveria 400 "Payload sin id reconocible").

  El CLAUDE.md del repo describe los tres como resueltos. Lo estan en la branch,
  no en la web que cobra plata real.

### 9. Webhook de Culqi end-to-end (PAY-01)
expected: Webhook registrado en CulqiPanel apuntando a `https://loboburger.com/api/culqi/webhook`. Un pago Yape real de S/5 crea la fila en `pedidos` con items, nombre, telefono y direccion recuperados de la `metadata` del cargo — incluso si el navegador nunca llama a `/api/charge`. Doble entrega del mismo evento no duplica el pedido.
result: [pending]

### 10. Cron de keep-alive y reconciliacion
expected: Con `CRON_SECRET` cargado y desplegado, el cron `0 9 * * *` corre: sin Bearer correcto devuelve 401, con el correcto devuelve `{ok:true}`, toca `pedidos` (keep-warm) y alerta por Telegram si encuentra un cargo de Culqi sin pedido.
result: pass
nota: |
  Verificado en vivo contra produccion tras el deploy:
  - sin header            -> 401
  - Bearer inventado      -> 401
  - Bearer correcto       -> 200 {"ok":true}
  El 200 implica que la query de keep-warm contra `pedidos` corrio sin error
  (el handler falla si la query falla), o sea Supabase se toca de verdad.
  `vercel.json` declara el schedule `0 9 * * *` (04:00 Lima).

  PENDIENTE menor: confirmar en Vercel -> Settings -> Cron Jobs que el job quedo
  registrado, y re-chequear el 2026-09-07 que Supabase no se autopauso (el free
  tier pausa a los 7 dias de inactividad; el cron diario lo evita).
  La rama de alerta por cargo huerfano no se puede verificar hasta tener Telegram
  configurado (test 11).

### 11. Alertas de Telegram y Sentry
expected: Con `TELEGRAM_ALERT_BOT_TOKEN`, `TELEGRAM_ALERT_CHAT_ID` y `SENTRY_DSN` cargados, un fallo de persistencia tras un cobro exitoso manda un mensaje a Telegram con cargo id, codigo, total y datos del cliente, y el error aparece en Sentry.
result: [pending]

## Summary

total: 11
passed: 9
issues: 0
pending: 2
skipped: 0
blocked: 0

pendientes: |
  9  — webhook end-to-end: necesita registrar el webhook en CulqiPanel + un pago
       Yape real de S/5 (el usuario tiene acceso a la cuenta de Culqi de Jaime y
       puede reembolsar).
  11 — Telegram/Sentry: el usuario no puede instalar Telegram en el celular por
       falta de espacio. Alternativa viable: web.telegram.org desde el navegador
       para crear el bot con @BotFather y el grupo de alertas. Sin esto las
       alertas quedan en console.error en los logs de Vercel.

## Gaps

[ninguno abierto — el unico hallazgo (migracion rate_limit sin aplicar, test 3) se cerro
durante esta misma sesion: el usuario la aplico desde el SQL Editor y se reverifico en vivo]
