import { getMenuItemLive } from "@/lib/menu-data";

const MIN_CENTS = 300; // S/3 mínimo para cargos
const MAX_CENTS = 50000;
const MAX_QTY = 20;

type ItemPedido = { id: number; qty: number };

type Cuerpo = {
  items?: ItemPedido[];
};

export async function POST(request: Request) {
  let body: Cuerpo;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "El carrito está vacío" }, { status: 400 });
  }

  let totalCents = 0;
  for (const linea of items) {
    if (!Number.isInteger(linea?.id) || !Number.isInteger(linea?.qty)) {
      return Response.json({ error: "Datos del pedido inválidos" }, { status: 400 });
    }
    if (linea.qty < 1 || linea.qty > MAX_QTY) {
      return Response.json({ error: "Cantidad no permitida" }, { status: 400 });
    }
    const item = await getMenuItemLive(linea.id);
    if (!item) {
      return Response.json({ error: "Hay un producto que ya no está disponible" }, { status: 400 });
    }
    if (item.agotado) {
      return Response.json({ error: "Un producto de tu pedido ya no está disponible" }, { status: 400 });
    }
    totalCents += item.precio_centimos * linea.qty;
  }

  if (totalCents < MIN_CENTS || totalCents > MAX_CENTS) {
    return Response.json({ error: "El monto del pedido no es válido" }, { status: 400 });
  }

  return Response.json({ totalCents, total: totalCents / 100 });
}
