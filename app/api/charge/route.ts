// Cobra en Culqi con la llave SECRETA y registra el pedido.
//
// Regla principal: el navegador manda QUE pidio (ids y cantidades), nunca
// CUANTO cuesta. El total se recalcula aca contra lib/menu.ts. Antes el monto
// venia del cliente y se podia pagar S/3 un pedido de S/38.

import * as Sentry from "@sentry/nextjs";
import { getMenuItem } from "@/lib/menu";
import { getSupabaseAdmin } from "@/lib/supabase";
import { alertaTelegram } from "@/lib/alertas";
import { validarEmail, validarTelefono } from "@/lib/validacion";

const MIN_CENTS = 300; // minimo que acepta Culqi
const MAX_CENTS = 50000; // techo sano para un pedido web
const MAX_QTY = 20; // por item, para que un pedido absurdo no pase

type ItemPedido = { id: number; qty: number };

type Cuerpo = {
  tokenId?: string;
  email?: string;
  items?: ItemPedido[];
  name?: string;
  phone?: string;
  delivery?: boolean;
  address?: string;
  lat?: number;
  lng?: number;
};

function codigoPedido(): string {
  return `LB-${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Pasarela no configurada" }, { status: 500 });
  }

  let body: Cuerpo;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { tokenId, email, items, name, phone } = body;
  if (
    typeof tokenId !== "string" ||
    typeof email !== "string" ||
    typeof name !== "string" ||
    typeof phone !== "string" ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return Response.json({ error: "Datos del pedido inválidos" }, { status: 400 });
  }

  // El navegador ya valida formato (app/checkout/page.tsx:56), pero es solo
  // una sugerencia: un request armado a mano evita el checkout por completo.
  // Esto corre ANTES del fetch a Culqi para no gastar un intento de cobro
  // con datos de contacto que de todas formas no sirven para nada.
  if (!validarEmail(email)) {
    return Response.json({ error: "El correo no tiene un formato válido" }, { status: 400 });
  }
  if (!validarTelefono(phone)) {
    return Response.json(
      { error: "El teléfono debe tener 9 dígitos y empezar en 9" },
      { status: 400 }
    );
  }

  // ── Total calculado en el servidor ──
  let totalCents = 0;
  const detalle: { id: number; name: string; price: number; qty: number }[] = [];
  for (const linea of items) {
    if (!Number.isInteger(linea?.id) || !Number.isInteger(linea?.qty)) {
      return Response.json({ error: "Datos del pedido inválidos" }, { status: 400 });
    }
    if (linea.qty < 1 || linea.qty > MAX_QTY) {
      return Response.json({ error: "Cantidad no permitida" }, { status: 400 });
    }
    const item = getMenuItem(linea.id);
    if (!item) {
      return Response.json({ error: "Hay un producto que ya no está disponible" }, { status: 400 });
    }
    totalCents += Math.round(item.price * 100) * linea.qty;
    detalle.push({ id: item.id, name: item.name, price: item.price, qty: linea.qty });
  }

  if (totalCents < MIN_CENTS || totalCents > MAX_CENTS) {
    return Response.json({ error: "El monto del pedido no es válido" }, { status: 400 });
  }

  const delivery = body.delivery === true;
  const address = delivery ? String(body.address || "").trim() : "";
  if (delivery && !address) {
    return Response.json({ error: "Falta la dirección de entrega" }, { status: 400 });
  }

  // ── Cargo en Culqi ──
  const res = await fetch("https://api.culqi.com/v2/charges", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: totalCents,
      currency_code: "PEN",
      email,
      source_id: tokenId,
      description: `Pedido Lobo Burger — ${detalle.length} producto(s)`,
    }),
  });

  const cargo = await res.json();

  if (!res.ok) {
    return Response.json(
      { error: cargo.user_message || "El pago fue rechazado. Verifica tu tarjeta." },
      { status: 402 }
    );
  }

  // ── Registro del pedido ──
  // A partir de aca el cobro YA ocurrio. Si el guardado falla, se responde
  // igual con exito y se deja el error en los logs: el cliente pago y no puede
  // quedarse sin confirmacion. El respaldo operativo es el boton de WhatsApp.
  const codigo = codigoPedido();
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pedidos")
      .insert({
        culqi_charge_id: cargo.id,
        codigo,
        cliente_nombre: name.trim(),
        cliente_telefono: phone.trim(),
        cliente_email: email.trim(),
        delivery,
        direccion: address || null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
        items: detalle,
        total_centimos: totalCents,
      })
      .select("codigo")
      .single();

    if (error) {
      // 23505 = unique_violation: este cargo ya genero un pedido (reintento
      // o doble envio). Se devuelve el pedido existente en vez de duplicar.
      if (error.code === "23505") {
        const { data: previo } = await getSupabaseAdmin()
          .from("pedidos")
          .select("codigo")
          .eq("culqi_charge_id", cargo.id)
          .single();
        return Response.json({
          chargeId: cargo.id,
          codigo: previo?.codigo ?? codigo,
          total: totalCents / 100,
        });
      }
      console.error("Pedido cobrado pero no registrado:", cargo.id, error);
      Sentry.captureException(error, { extra: { cargoId: cargo.id, codigo, totalCents } });
      await alertaTelegram(
        `Pedido cobrado pero NO registrado.\n` +
          `Cargo Culqi: ${cargo.id}\n` +
          `Codigo: ${codigo}\n` +
          `Total: S/${totalCents / 100}\n` +
          `Cliente: ${name.trim()} - ${phone.trim()}`
      );
    }

    return Response.json({
      chargeId: cargo.id,
      codigo: data?.codigo ?? codigo,
      total: totalCents / 100,
    });
  } catch (e) {
    console.error("Pedido cobrado pero no registrado:", cargo.id, e);
    Sentry.captureException(e, { extra: { cargoId: cargo.id, codigo, totalCents } });
    await alertaTelegram(
      `Pedido cobrado pero NO registrado.\n` +
        `Cargo Culqi: ${cargo.id}\n` +
        `Codigo: ${codigo}\n` +
        `Total: S/${totalCents / 100}\n` +
        `Cliente: ${name.trim()} - ${phone.trim()}`
    );
    return Response.json({ chargeId: cargo.id, codigo, total: totalCents / 100 });
  }
}
