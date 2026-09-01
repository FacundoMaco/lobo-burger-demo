// Crea la Orden de Culqi que habilita Yape en el checkout embebido.
//
// El Checkout Custom solo muestra tarjeta cuando `settings.order` viene
// vacio (ver docs.culqi.com/checkout-custom) — Yape, PagoEfectivo y
// Cuotealo necesitan una Orden creada de antemano contra POST /v2/orders.
// El monto se recalcula aca contra lib/menu.ts, con la misma regla que
// /api/charge: el cliente nunca decide cuanto se cobra.

import { getMenuItem } from "@/lib/menu";

const MIN_CENTS = 300; // minimo que acepta Culqi
const MAX_CENTS = 50000; // techo sano para un pedido web
const MAX_QTY = 20;

type ItemPedido = { id: number; qty: number };

type Cuerpo = {
  items?: ItemPedido[];
  name?: string;
  phone?: string;
  email?: string;
};

function ordenUnica(): string {
  return `LB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

  const { items, name, phone, email } = body;
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    typeof name !== "string" ||
    typeof phone !== "string" ||
    typeof email !== "string"
  ) {
    return Response.json({ error: "Datos del pedido inválidos" }, { status: 400 });
  }

  let totalCents = 0;
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
  }

  if (totalCents < MIN_CENTS || totalCents > MAX_CENTS) {
    return Response.json({ error: "El monto del pedido no es válido" }, { status: 400 });
  }

  // client_details.first_name/last_name son requeridos por Culqi; un nombre
  // sin espacios (comun) usa la misma palabra en ambos.
  const partesNombre = name.trim().split(/\s+/);
  const firstName = partesNombre[0] || "Cliente";
  const lastName = partesNombre.slice(1).join(" ") || firstName;

  const res = await fetch("https://api.culqi.com/v2/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: totalCents,
      currency_code: "PEN",
      description: "Pedido Lobo Burger",
      order_number: ordenUnica(),
      client_details: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: `+51${phone.trim()}`,
      },
      expiration_date: Math.floor(Date.now() / 1000) + 20 * 60,
    }),
  });

  const orden = await res.json();
  if (!res.ok) {
    return Response.json(
      { error: orden.user_message || "No se pudo iniciar el pago" },
      { status: 502 }
    );
  }

  return Response.json({ orderId: orden.id, amount: totalCents });
}
