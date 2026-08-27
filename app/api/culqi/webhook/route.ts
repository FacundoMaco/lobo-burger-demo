// Handler definitivo del webhook de Culqi (PAY-02, PAY-03, PAY-04). Reemplaza
// el endpoint temporal de captura del plan 01-02.
//
// Regla principal (D-08): el body del POST es un PUNTERO, nunca un hecho.
// Culqi no publica firma HMAC para sus webhooks (verificado, no asumido -- ver
// 01-RESEARCH.md), asi que la unica verificacion de confianza real posible es
// extraer el id y re-consultar GET /v2/charges/{id} contra Culqi antes de
// escribir una sola fila en "pedidos".
//
// D-09: el webhook garantiza que la fila EXISTA, no es dueno del estado del
// pedido -- nunca hace un update sobre una fila que /api/charge ya escribio
// (la constraint unica de culqi_charge_id mas el catch de 23505 resuelven la
// carrera, mismo patron que app/api/charge/route.ts:134-148).
//
// Opcion C (checkpoint Task 2 del plan 01-07, decision del usuario): el
// detalle del pedido viaja en el "metadata" del cargo, escrito por
// /api/charge en el momento del cobro. El webhook lo recupera del mismo GET
// que ya hace para verificar el cargo. Defensivo: si la metadata viene
// ausente, vacia o no parseable, se degrada al comportamiento de la opcion A
// -- se crea la fila con lo que hay (monto y email de Culqi, el resto con un
// marcador) y se alerta, en vez de fallar. El peor caso nunca es peor que A.
//
// D-10: cero logica basada en cuantas veces Culqi vuelve a mandar el evento o
// cuanto tiempo paso desde el primer envio -- esos numeros no estan
// documentados. Este handler responde 200 solo cuando la fila ya existe, y
// no-2xx ante un fallo real (Supabase caido) para que un eventual reenvio del
// evento por parte de Culqi tenga oportunidad de recuperar.

import { getSupabaseAdmin } from "@/lib/supabase";
import { alertaTelegram } from "@/lib/alertas";
import { consultarCargo, extraerChargeId } from "@/lib/culqi-verificar";

function codigoPedido(): string {
  return `LB-${Date.now().toString(36).toUpperCase()}`;
}

// Marcador para las columnas que hoy son "not null" en el schema de pedidos
// (cliente_nombre, cliente_telefono) cuando la metadata no trae con que
// llenarlas. Evita depender de una migracion que hoy no se puede aplicar
// (Supabase free tier autopausado) para que la degradacion funcione.
const SIN_DATOS = "(sin datos -- pago sin metadata recuperable, ver alerta de Telegram)";

type ItemMetadata = { id: number; qty: number };

type PedidoDesdeMetadata = {
  items: ItemMetadata[];
  nombre: string;
  telefono: string;
  delivery: boolean;
  direccion: string | null;
};

// Parseo defensivo de la metadata que /api/charge escribio en el cargo
// (app/api/charge/route.ts, campo metadataPedido). Devuelve null ante
// CUALQUIER forma inesperada -- eso dispara la degradacion a fila
// incompleta, nunca un fallo del handler.
function parsearMetadata(raw: unknown): PedidoDesdeMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const pedidoRaw = (raw as Record<string, unknown>).pedido;
  if (typeof pedidoRaw !== "string" || pedidoRaw.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(pedidoRaw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.items) || typeof p.nombre !== "string" || typeof p.telefono !== "string") {
    return null;
  }

  const items = p.items.filter(
    (i): i is ItemMetadata =>
      !!i &&
      typeof i === "object" &&
      Number.isInteger((i as Record<string, unknown>).id) &&
      Number.isInteger((i as Record<string, unknown>).qty)
  );
  // Un "pedido" sin items no le sirve a la cocina mas que la degradacion
  // total -- se trata igual que metadata ausente, no como un pedido parcial.
  if (items.length === 0) return null;

  return {
    items,
    nombre: p.nombre,
    telefono: p.telefono,
    delivery: p.delivery === true,
    direccion: typeof p.direccion === "string" ? p.direccion : null,
  };
}

async function alertarSinMetadata(chargeId: string, codigo: string, email: string): Promise<void> {
  await alertaTelegram(
    `Webhook de Culqi: pago confirmado sin metadata recuperable.\n` +
      `Cargo Culqi: ${chargeId}\n` +
      `Codigo generado: ${codigo}\n` +
      `Email: ${email}\n` +
      `Revisar el pedido y contactar al cliente manualmente.`
  );
}

async function alertarFalloDeEscritura(chargeId: string, detalle: string): Promise<void> {
  await alertaTelegram(
    `Webhook de Culqi: cargo confirmado pero el pedido NO se pudo registrar.\n` +
      `Cargo Culqi: ${chargeId}\n` +
      `Detalle: ${detalle}`
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const chargeId = extraerChargeId(body);
  if (!chargeId) {
    return Response.json({ error: "Payload sin id reconocible" }, { status: 400 });
  }

  // Puntero verificado: se pregunta a Culqi, nunca se confia en el body
  // (T-01-33). Un id inventado o que Culqi no reconoce no escribe nada.
  const cargo = await consultarCargo(chargeId);
  if (!cargo) {
    return new Response("OK", { status: 200 });
  }

  const pedido = parsearMetadata(cargo.metadata);
  const codigo = codigoPedido();

  const fila = pedido
    ? {
        culqi_charge_id: cargo.id,
        codigo,
        cliente_nombre: pedido.nombre,
        cliente_telefono: pedido.telefono,
        cliente_email: cargo.email,
        delivery: pedido.delivery,
        direccion: pedido.direccion,
        items: pedido.items,
        // El monto que se escribe es siempre el de Culqi, nunca el del body
        // del webhook (T-01-34).
        total_centimos: cargo.amount,
      }
    : {
        culqi_charge_id: cargo.id,
        codigo,
        cliente_nombre: SIN_DATOS,
        cliente_telefono: SIN_DATOS,
        cliente_email: cargo.email,
        delivery: false,
        direccion: null,
        items: [],
        total_centimos: cargo.amount,
      };

  try {
    const { error } = await getSupabaseAdmin()
      .from("pedidos")
      .insert(fila)
      .select("codigo")
      .single();

    if (error) {
      // 23505 = unique_violation: la fila ya existe -- /api/charge la
      // escribio primero (carrera, T-01-35) o Culqi volvio a mandar el mismo
      // evento. El webhook NUNCA actualiza una fila existente (D-09,
      // T-01-36): responde 200 y no hace nada mas.
      if (error.code === "23505") {
        return new Response("OK", { status: 200 });
      }

      console.error("Webhook: cargo confirmado pero no se pudo registrar el pedido:", cargo.id, error);
      await alertarFalloDeEscritura(cargo.id, error.message ?? "error desconocido");
      // No-2xx a proposito (T-01-38, D-10): si Culqi vuelve a mandar el
      // evento, que tenga oportunidad real de recuperar en vez de perderse.
      return Response.json({ error: "No se pudo registrar el pedido" }, { status: 500 });
    }

    if (!pedido) {
      await alertarSinMetadata(cargo.id, codigo, cargo.email);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    console.error("Webhook: excepcion al registrar el pedido:", cargo.id, e);
    await alertarFalloDeEscritura(cargo.id, mensaje);
    return Response.json({ error: "No se pudo registrar el pedido" }, { status: 500 });
  }
}
