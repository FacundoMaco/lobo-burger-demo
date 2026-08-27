# Flujo real de Culqi — hallazgos verificados contra la API

**Estado: PARCIAL.** Este documento debía producirlo el plan 01-02, que quedó
bloqueado en su propio checkpoint antes de un pago real (ver
`01-02-SUMMARY-PARCIAL.md`). El plan 01-07 trabajó bajo supuestos explícitos
sin poder completarlo (ver `01-07-SUMMARY.md`, Assumption A1). El plan 01-08
agrega la sección de listado de cargos de abajo, también sin poder cerrar el
estado PARCIAL: sigue faltando el pago real de la Task 4 de 01-07 y una
`CULQI_SECRET_KEY` real disponible en un entorno con acceso a Internet para
confirmar el resto.

## Flujo activo (sin confirmar — heredado de 01-07)

Supuesto no verificado: token síncrono (`chr_...`, evento `charge.succeeded`)
para el Yape embebido, según una captura de pantalla del checkout en
producción. `extraerChargeId()` en `lib/culqi-verificar.ts` no discrimina por
prefijo, así que tolera `chr_` u `ord_` sin necesitar la confirmación.

## Listado de cargos recientes (plan 01-08, Task 2)

**Objetivo:** encontrar la forma real de `GET /v2/charges` con filtro de
fecha, para que el cron de reconciliación pueda listar "los cargos de hoy".

**Lo que se intentó en este entorno de ejecución (worktree del agente, sin
`.env.local`, sin `CULQI_SECRET_KEY` real):**

```
curl -s "https://api.culqi.com/v2/charges" -H "Authorization: Bearer sk_test_invalid"
curl -s "https://api.culqi.com/v2/charges?created_at%5Bfrom%5D=...&created_at%5Bto%5D=..." \
  -H "Authorization: Bearer sk_test_invalid"
```

Ambas llamadas devuelven el mismo error, antes de que Culqi llegue a mirar
ningún parámetro de query:

```json
{"object": "error", "type": "authentication_error", "merchant_message": "La llave de autenticación enviada no es válida...", "user_message": "..."}
```

Es decir: **con una llave inválida, Culqi rechaza la petición completa por
autenticación antes de validar filtros — no hay forma de inferir el formato
de fecha/paginación aceptado sin una `CULQI_SECRET_KEY` real.**
`docs.culqi.com` es una SPA renderizada por JS (confirmado por `curl`, ver
`01-RESEARCH.md`), así que tampoco se pudo extraer la spec por scraping
estático.

**Decisión tomada (siguiendo la instrucción explícita de 01-08-PLAN.md: "Si
la API no permite filtrar por fecha de manera útil, decirlo y acotar el
alcance a lo que sí permita — no inventar parámetros"):**

`app/api/cron/reconciliacion/route.ts` lista cargos usando **solo el
parámetro `limit`** (`GET /v2/charges?limit=20`), sin ningún filtro de fecha.
`limit` es la convención REST más universal y de menor riesgo de rechazo; un
filtro de fecha inventado (`created_at[from]`, `date_from`, `since`, etc.)
podría ser ignorado en silencio por Culqi (peor: devolver TODOS los cargos
históricos sin que el código lo note) o rechazado con un 4xx que rompería la
reconciliación entera.

**Riesgo aceptado y documentado:** sin filtro de fecha, el cron asume que
Culqi devuelve los cargos ordenados del más reciente al más antiguo (orden
típico de listados de cargos/transacciones, no confirmado específicamente
para Culqi). Si el orden real fuera el inverso, `limit=20` traería los 20
cargos MÁS VIEJOS, no los recientes — la reconciliación diaria dejaría de
cubrir el día actual. Esto solo se puede confirmar con una llamada real y
autenticada.

**Parseo defensivo de la respuesta:** tampoco se pudo confirmar si el
listado devuelve un array plano o `{ data: [...] }` (Culqi documenta esta
segunda forma para el cargo individual envuelto, ver `01-RESEARCH.md`
Sources). `listarCargosRecientes()` tolera ambas formas.

## Impacto en el diseño del webhook

Ninguno nuevo. El listado de cargos es exclusivo del cron de reconciliación;
`app/api/culqi/webhook/route.ts` sigue usando únicamente
`consultarCargo(id)` (un cargo por vez), que sí está verificado contra la
API real (`01-07-SUMMARY.md`).

## Qué falta para pasar de PARCIAL a RESUELTO

1. Un pago real (Task 4 de `01-07-PLAN.md`) para confirmar el payload del
   webhook y el prefijo del id.
2. Una `CULQI_SECRET_KEY` real, con acceso a Internet, para:
   - Confirmar el orden de `GET /v2/charges` (recientes primero o últimos).
   - Confirmar si acepta algún filtro de fecha, y su formato exacto.
   - Confirmar la forma de la respuesta (`data: [...]` vs. array plano).
3. Actualizar `listarCargosRecientes()` en
   `app/api/cron/reconciliacion/route.ts` con lo que se confirme, y
   estrechar el parseo defensivo si ya no hace falta tolerar ambas formas.
