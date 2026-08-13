import { getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

// Campos obligatorios del Anexo I (DS 011-2011-PCM).
const REQUIRED = [
  "tipo",
  "sede",
  "consumidor_nombre",
  "consumidor_domicilio",
  "consumidor_documento",
  "consumidor_telefono",
  "consumidor_email",
  "bien_descripcion",
  "detalle",
  "pedido_concreto",
] as const;

function folioDe(id: number, createdAt: string): string {
  const d = new Date(createdAt);
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
  return `LR-${ymd}-${String(id).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return Response.json({ error: "Libro de reclamaciones no configurado" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  for (const field of REQUIRED) {
    if (typeof body[field] !== "string" || !(body[field] as string).trim()) {
      return Response.json({ error: `Falta el campo ${field}` }, { status: 400 });
    }
  }
  if (body.tipo !== "reclamo" && body.tipo !== "queja") {
    return Response.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (body.sede !== "Surquillo" && body.sede !== "SJM") {
    return Response.json({ error: "Sede inválida" }, { status: 400 });
  }

  const esMenor = body.es_menor_edad === true;
  if (esMenor && !String(body.representante_nombre || "").trim()) {
    return Response.json({ error: "Falta el nombre del representante" }, { status: 400 });
  }

  const montoRaw = String(body.monto_reclamado ?? "").trim();
  const monto = montoRaw ? Number(montoRaw) : null;
  if (monto !== null && (!Number.isFinite(monto) || monto < 0)) {
    return Response.json({ error: "Monto inválido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reclamaciones")
    .insert({
      tipo: body.tipo,
      sede: body.sede,
      consumidor_nombre: String(body.consumidor_nombre).trim(),
      consumidor_domicilio: String(body.consumidor_domicilio).trim(),
      consumidor_documento: String(body.consumidor_documento).trim(),
      consumidor_telefono: String(body.consumidor_telefono).trim(),
      consumidor_email: String(body.consumidor_email).trim(),
      es_menor_edad: esMenor,
      representante_nombre: esMenor ? String(body.representante_nombre).trim() : null,
      bien_descripcion: String(body.bien_descripcion).trim(),
      monto_reclamado: monto,
      detalle: String(body.detalle).trim(),
      pedido_concreto: String(body.pedido_concreto).trim(),
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error al registrar reclamación:", error);
    return Response.json({ error: "No pudimos registrar tu reclamación" }, { status: 500 });
  }

  const folio = folioDe(data.id, data.created_at);

  // El aviso por email es best-effort: si falla, la reclamación ya quedó registrada.
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.RECLAMOS_EMAIL_TO;
  if (apiKey && to) {
    try {
      await new Resend(apiKey).emails.send({
        from: "Lobo Burger <onboarding@resend.dev>",
        to,
        subject: `Nuevo ${data.tipo} — ${folio} (${data.sede})`,
        text: [
          `Folio: ${folio}`,
          `Tipo: ${data.tipo}`,
          `Sede: ${data.sede}`,
          `Consumidor: ${data.consumidor_nombre} (${data.consumidor_documento})`,
          `Teléfono: ${data.consumidor_telefono}`,
          `Email: ${data.consumidor_email}`,
          `Domicilio: ${data.consumidor_domicilio}`,
          data.es_menor_edad ? `Representante: ${data.representante_nombre}` : null,
          `Bien/servicio: ${data.bien_descripcion}`,
          data.monto_reclamado ? `Monto reclamado: S/${data.monto_reclamado}` : null,
          "",
          `Detalle: ${data.detalle}`,
          "",
          `Pedido del consumidor: ${data.pedido_concreto}`,
          "",
          "Plazo legal de respuesta: 15 días hábiles improrrogables.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (e) {
      console.error("No se pudo enviar el aviso de reclamación:", e);
    }
  }

  return Response.json({ ok: true, folio, createdAt: data.created_at });
}
