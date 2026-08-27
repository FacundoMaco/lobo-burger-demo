// Rate limit por IP para POST /api/charge (PAY-06). El contador vive en
// Postgres (supabase/migrations/20260825000000_rate_limit.sql), no en
// memoria: cada invocacion serverless de Vercel puede caer en una instancia
// distinta y un Map a nivel de modulo no comparte estado entre ellas
// (Pitfall 11) -- daria una falsa sensacion de proteccion.
//
// D-26: separar lo puro (calcularWindowStart, debeBloquear) de lo impuro
// (contarIntento) porque solo lo primero es unit-testeable sin red. La
// atomicidad real del incremento la garantiza el "on conflict" de Postgres,
// nunca este archivo -- eso se verifica a mano con procesos concurrentes
// reales (Task 5 del plan 01-06), no con un mock.

import { getSupabaseAdmin } from "@/lib/supabase";
import { alertaTelegram } from "@/lib/alertas";

// Ventana fija de 1 hora: coincide con el p_max_age por defecto de la
// limpieza oportunista en la migracion, asi la ventana activa nunca se
// borra a mitad de camino.
export const VENTANA_MS = 60 * 60 * 1000;

// Un local como Lobo Burger hace decenas de pedidos por dia, no miles. 10
// intentos por hora por IP deja margen para 2-3 reintentos honestos de una
// tarjeta rechazada sin abrir la puerta a un script de card testing.
export const LIMITE_INTENTOS = 10;

// Pura: recibe "now" como parametro (nunca llama a Date.now() internamente)
// para poder probarla de forma determinista. Ventana fija (no deslizante):
// el inicio de la ventana es el multiplo de windowMs mas cercano hacia
// abajo desde epoch.
export function calcularWindowStart(now: number, windowMs: number): string {
  return new Date(Math.floor(now / windowMs) * windowMs).toISOString();
}

// Pura y deliberadamente trivial: existe para que el limite sea un valor
// testeable y no un "if" enterrado en el handler. En el limite exacto NO
// bloquea -- el limite es la cantidad de intentos permitidos, no el primero
// que se rechaza.
export function debeBloquear(intentos: number, limite: number): boolean {
  return intentos > limite;
}

// Impura: llama al RPC atomico de Postgres.
//
// Decision fail-open (Task 1 del plan 01-06, tomada por el usuario): si
// Supabase no responde, el cobro sigue adelante (se devuelve 0, que nunca
// bloquea) en vez de tumbar el checkout. Razones:
//   1. Coherencia con el resto del handler: el insert en "pedidos" tras un
//      cobro exitoso YA es no-fatal (app/api/charge/route.ts). El sistema ya
//      decidio que una caida de Supabase no tumba una venta; fail-closed
//      aca contradiria esa postura en el mismo archivo.
//   2. El rate limit es defensa en profundidad, no la unica barrera --
//      Culqi tiene sus propios controles antifraude. Perder ventas un
//      viernes 20:00 es dano cierto; quedar ciego al card testing un rato
//      es riesgo acotado, y ademas queda alertado.
//   3. Riesgo aceptado explicitamente: si alguien descubre que puede cegar
//      el rate limiter esperando a que Supabase se autopause (free tier),
//      fail-open es la ventana que busca. El cron keep-alive del plan 01-08
//      la achica, pero no la elimina. Esto queda anotado como riesgo
//      conocido, no como un accidente de implementacion.
export async function contarIntento(ip: string, windowMs: number): Promise<number> {
  const windowStart = calcularWindowStart(Date.now(), windowMs);
  try {
    const { data, error } = await getSupabaseAdmin().rpc("increment_rate_limit", {
      p_ip: ip,
      p_window_start: windowStart,
    });
    if (error) {
      await alertarRateLimiterCiego(ip, error.message ?? "error desconocido");
      return 0;
    }
    return data as number;
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await alertarRateLimiterCiego(ip, mensaje);
    return 0;
  }
}

async function alertarRateLimiterCiego(ip: string, detalle: string): Promise<void> {
  await alertaTelegram(
    `El rate limit de /api/charge quedo ciego (fail-open): no se pudo contar el intento.\n` +
      `IP: ${ip}\n` +
      `Detalle: ${detalle}`
  );
}
