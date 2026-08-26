// Endpoint TEMPORAL de captura del payload del webhook de Culqi (PAY-01).
//
// Este archivo NO es el handler definitivo: el plan 01-07 lo reemplaza por el
// handler real (D-08/D-09/D-10 en 01-RESEARCH.md — payload como puntero,
// re-fetch contra Culqi, upsert idempotente). Su unico proposito hoy es
// descubrir con evidencia real que flujo de Yape esta vivo (chr_ vs ord_) y
// como se ve el payload que Culqi realmente POSTea, algo que Culqi no publica
// en ningun lugar accesible (ver PITFALLS.md).
//
// No escribe en Supabase, no llama a la API de Culqi, no parsea el body
// buscando un id: eso llega recien en 01-07, ya con el payload real conocido.

export async function POST(request: Request) {
  // Se lee como texto crudo, no parseado como JSON: si Culqi mandara
  // application/x-www-form-urlencoded o cualquier cosa que no sea JSON, el
  // parseo tiraria y se perderia justamente lo que se quiere capturar.
  const body = await request.text();

  const contentType = request.headers.get("content-type") ?? "(sin content-type)";
  const headerNames = Array.from(request.headers.keys());

  // Prefijo constante y grepeable: sin el, el payload se pierde en el ruido
  // de los logs de Vercel.
  console.log(
    "[PAY-01] webhook payload",
    JSON.stringify({ contentType, headerNames, body })
  );

  return new Response("OK", { status: 200 });
}
