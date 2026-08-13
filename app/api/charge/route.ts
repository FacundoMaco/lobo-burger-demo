// Crea el cargo en Culqi con la llave SECRETA — nunca exponerla al cliente.

const MIN_CENTS = 300; // S/3 — mínimo que acepta Culqi
const MAX_CENTS = 50000; // S/500 — techo sano para un pedido web

export async function POST(request: Request) {
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) {
    return Response.json({ error: "Pasarela no configurada" }, { status: 500 });
  }

  let body: { tokenId?: string; email?: string; amount?: number; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { tokenId, email, amount, description } = body;
  if (
    typeof tokenId !== "string" ||
    typeof email !== "string" ||
    !Number.isInteger(amount) ||
    amount! < MIN_CENTS ||
    amount! > MAX_CENTS
  ) {
    return Response.json({ error: "Datos de pago inválidos" }, { status: 400 });
  }

  const res = await fetch("https://api.culqi.com/v2/charges", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency_code: "PEN",
      email,
      source_id: tokenId,
      description: (description || "Pedido Lobo Burger").slice(0, 80),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json(
      { error: data.user_message || "El pago fue rechazado. Verifica tu tarjeta." },
      { status: 402 }
    );
  }

  return Response.json({ chargeId: data.id });
}
