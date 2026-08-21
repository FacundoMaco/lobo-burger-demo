// Pedidos para el panel. Protegido por Basic Auth en proxy.ts.
// Los pedidos viven en Supabase, asi que el restaurante los ve desde
// cualquier dispositivo — antes solo existian en el navegador del cliente.

import { getSupabaseAdmin } from "@/lib/supabase";

const ESTADOS = ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"];

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pedidos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return Response.json({ pedidos: data ?? [] });
  } catch (e) {
    console.error("No se pudieron leer los pedidos:", e);
    return Response.json({ error: "No se pudieron leer los pedidos" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: { codigo?: string; estado?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { codigo, estado } = body;
  if (typeof codigo !== "string" || typeof estado !== "string" || !ESTADOS.includes(estado)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const { error } = await getSupabaseAdmin()
      .from("pedidos")
      .update({ estado })
      .eq("codigo", codigo);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    console.error("No se pudo actualizar el pedido:", e);
    return Response.json({ error: "No se pudo actualizar el pedido" }, { status: 500 });
  }
}
