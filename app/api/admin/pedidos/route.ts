// Pedidos para el panel. Protegido por Basic Auth en proxy.ts.
// Los pedidos viven en Supabase, asi que el restaurante los ve desde
// cualquier dispositivo — antes solo existian en el navegador del cliente.

import { getSupabaseAdmin } from "@/lib/supabase";

const ESTADOS = ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"];

interface SimulatedOrder {
  codigo: string;
  [key: string]: unknown;
}

// Almacén en memoria de pedidos simulados para que no se borren si Supabase está offline
const simulatedOrdersStore: SimulatedOrder[] = [];


export async function GET() {
  try {
    const { data } = await getSupabaseAdmin()
      .from("pedidos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const dbOrders = data ?? [];
    const dbCodes = new Set(dbOrders.map((d: { codigo?: string }) => d.codigo));
    const activeSimulated = simulatedOrdersStore.filter(s => !dbCodes.has(s.codigo));
    return Response.json({ pedidos: [...activeSimulated, ...dbOrders] });
  } catch (e) {
    console.warn("Supabase offline, devolviendo pedidos en memoria:", e);
    return Response.json({ pedidos: simulatedOrdersStore });
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


export async function POST(request: Request) {
  let body: {
    codigo?: string;
    name?: string;
    phone?: string;
    email?: string;
    delivery?: boolean;
    address?: string;
    items?: { id: number; name: string; price: number; qty: number }[];
    total_centimos?: number;
  } = {};

  try {
    body = await request.json();
  } catch {
    // Body opcional
  }

  const codigo = body.codigo || `LB-${Math.floor(1000 + Math.random() * 9000)}`;
  const simPedido = {
    codigo,
    cliente_nombre: body.name || "Jaime Lobo (Simulación)",
    cliente_telefono: body.phone || "987654321",
    cliente_email: body.email || "jaime@loboburger.com",
    delivery: body.delivery ?? true,
    direccion: body.address || "Av. Angamos Este 1551, Surquillo",
    items: body.items || [
      { id: 5, name: "Burgazo", price: 28, qty: 1 },
      { id: 13, name: "Combo Lobo", price: 25, qty: 1 },
    ],
    total_centimos: body.total_centimos || 5300,
    estado: "pendiente",
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("pedidos")
      .insert([simPedido])
      .select()
      .single();

    simulatedOrdersStore.unshift(simPedido);
    if (simulatedOrdersStore.length > 30) simulatedOrdersStore.pop();

    if (!error && data) {
      return Response.json({ ok: true, pedido: data });
    }
  } catch (e) {
    console.warn("Supabase no disponible para pedido simulado:", e);
    simulatedOrdersStore.unshift(simPedido);
    if (simulatedOrdersStore.length > 30) simulatedOrdersStore.pop();
  }

  return Response.json({ ok: true, pedido: simPedido });
}
