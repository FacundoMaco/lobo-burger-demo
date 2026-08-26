# Hallazgos de caracterizacion — `app/api/charge/route.ts`

**Plan:** 01-01
**Fecha:** 2026-08-26
**Metodo:** D-25 — tests contra el comportamiento actual del handler, corridos
SIN tocar produccion. Gate invertido: se esperaba verde al primer intento.

## Resultado del gate

**GATE VERDE.** Los 25 tests de `__tests__/api-charge.caracterizacion.test.ts`
pasaron en verde al primer intento, sin modificar una sola linea de
`app/api/charge/route.ts`. No se encontro ningun bug preexistente que requiera
`it.fails`/`it.skip`.

## Observaciones (no son bugs)

1. **MIN_CENTS (300 centimos) es hoy inalcanzable con la carta vigente.** El
   item mas barato es la Gaseosa a S/5 = 500 centimos. No existe combinacion
   de items que produzca un total entre 1 y 299 centimos (no hay items de
   precio 0, y la validacion de `qty >= 1` impide un total de 0 si hay al
   menos una linea). No se escribio un test que finja cubrir esta rama --
   queda documentado aca en vez de simularse. Si en el futuro se agrega un
   item mas barato que S/3, esta rama se vuelve alcanzable y merece un test
   real en ese momento.

## Verificacion antiregresion (obligatoria, no commiteada)

Se rompio produccion a proposito para confirmar que el test antiregresion de
precio realmente protege algo:

- **Cambio introducido:** despues del loop que recalcula `totalCents` contra
  `lib/menu.ts`, se agrego una linea que sobreescribe `totalCents` con
  `body.amount` si el cliente lo manda (replicando el bug historico exacto:
  "el monto venia del cliente").
- **Resultado:** `npm run test:run` fallo exactamente 1 de 28 tests -- el
  test `ANTIREGRESION -- ignora un amount/total enviado por el cliente y
  sigue cobrando 4100` (`expected 300 to be 4100`). Los otros 27 tests
  siguieron en verde, como se esperaba (el resto del contrato del handler no
  cambio).
- **Revertido:** el cambio se deshizo inmediatamente despues de confirmar el
  fallo. `git diff --exit-code -- app/ lib/` volvio a dar exit code 0 antes
  de cualquier commit. El cambio de prueba nunca se commiteo.

## Cobertura obligatoria (D-18), confirmada

- Recalculo del total contra `lib/menu.ts`, ignorando `amount`/`total`/precio
  enviados por el cliente.
- Bounds: `MAX_QTY` (21 y 0), `MAX_CENTS` (Combo Bestia x20 = 76000
  centimos), `MIN_CENTS` documentado como inalcanzable (ver arriba).
- Rama `23505` (idempotencia): confirma que se consulta por
  `culqi_charge_id`, no por otra columna.
- Rama de fallo de insert (no `23505`) tras cargo exitoso: responde 200 y
  hace `console.error("Pedido cobrado pero no registrado:", cargo.id, ...)`
  -- el ancla exacta donde el plan 01-03 va a agregar `alertaTelegram()`
  (PAY-05).
- Excepcion de `getSupabaseAdmin()` tras cargo exitoso: mismo comportamiento
  (200 + `console.error` con el mismo texto).

## Otros hallazgos

Ninguno.
