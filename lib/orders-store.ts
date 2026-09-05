// CLEAN-02: este archivo YA NO persiste pedidos. Los pedidos reales viven en
// Supabase desde el commit eb9f243 (app/api/charge/route.ts inserta en
// "pedidos", el panel /admin lee de /api/admin/pedidos). Lo unico que sigue
// vivo aca es la FORMA del objeto que necesitan la pantalla de confirmacion
// (app/checkout/page.tsx) y buildWhatsAppUrl (lib/cart-context.tsx), que es
// el respaldo operativo cuando el insert a Supabase falla. Si en el futuro
// hace falta "arreglar" la falta de persistencia: no es un bug, es a
// proposito -- la persistencia real ya existe en Supabase.

export type OrderStatus = "pendiente" | "en_preparacion" | "listo" | "entregado";

export type Order = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email?: string;
  culqiChargeId?: string;
  delivery: boolean;
  address: string;
  lat?: number;
  lng?: number;
  items: { id: number; name: string; price: number; qty: number; cremas?: string[]; pan?: string; papas?: string; comentario?: string }[];
  total: number;
  status: OrderStatus;
};

export function construirOrderLocal(order: Omit<Order, "id" | "createdAt" | "status">): Order {
  return {
    ...order,
    id: `LB-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "pendiente",
  };
}
