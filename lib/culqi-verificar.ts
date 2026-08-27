// Puntero y re-fetch del webhook de Culqi (D-08). Culqi no publica firma HMAC
// para verificar webhooks (verificado en 01-RESEARCH.md, no asumido), asi que
// la unica verificacion real posible es preguntarle a Culqi directamente por
// el cargo antes de escribir nada en Supabase. Dos exports separados por
// testeabilidad (D-26): extraerChargeId() es pura, sin red; consultarCargo()
// es impura y hace el GET autenticado.
//
// SUPUESTO PAY-01 (NO VERIFICADO): el plan 01-02 quedo bloqueado antes de
// capturar un payload real (01-CULQI-FLUJO.md no existe). La unica evidencia
// disponible es una captura del checkout en produccion que muestra el flujo
// Yape de "codigo de aprobacion" (culqi.token), lo que sugiere prefijo chr_ y
// evento charge.succeeded -- no ord_/order.status.changed. extraerChargeId()
// no discrimina por prefijo: acepta cualquier string en las formas conocidas
// y deja que consultarCargo() sea la verificacion real (un id invalido o de
// la forma equivocada simplemente devuelve 404). Esto tolera tanto chr_ como
// ord_ sin necesidad de adivinar cual esta vivo. Confirmar con el pago real
// de la Task 4 y actualizar este comentario si el payload difiere.

export function extraerChargeId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.id === "string") return b.id;

  if (b.data && typeof b.data === "object" && !Array.isArray(b.data)) {
    const id = (b.data as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }

  if (b.object && typeof b.object === "object" && !Array.isArray(b.object)) {
    const id = (b.object as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }

  return null;
}

export type CargoCulqi = {
  id: string;
  amount: number;
  state: string;
  email: string;
};

// Mismo header que el POST existente en app/api/charge/route.ts:89 (A5 en
// 01-RESEARCH.md: no verificado contra la spec Swagger, pero consistente con
// el patron REST que Culqi ya usa en este repo).
export async function consultarCargo(id: string): Promise<CargoCulqi | null> {
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) return null; // falla cerrado, mismo patron que app/api/charge/route.ts:37-40

  const res = await fetch(`https://api.culqi.com/v2/charges/${id}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: data.id,
    amount: data.amount,
    // "outcome.type" es el campo que Culqi documenta para el resultado del
    // cargo (p.ej. "venta_exitosa"); no verificado contra un pago real -- ver
    // supuesto arriba.
    state: typeof data.outcome?.type === "string" ? data.outcome.type : "desconocido",
    email: data.email,
  };
}
