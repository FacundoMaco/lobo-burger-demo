export type OrderStatus = "pendiente" | "en_preparacion" | "listo" | "entregado";

export type Order = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  delivery: boolean;
  address: string;
  items: { id: number; name: string; price: number; qty: number }[];
  total: number;
  status: OrderStatus;
};

export function saveOrder(order: Omit<Order, "id" | "createdAt" | "status">): Order {
  const newOrder: Order = {
    ...order,
    id: `LB-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "pendiente",
  };
  const existing = getOrders();
  localStorage.setItem("lobo_orders", JSON.stringify([newOrder, ...existing]));
  return newOrder;
}

export function getOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("lobo_orders") || "[]");
  } catch {
    return [];
  }
}

export function updateOrderStatus(id: string, status: OrderStatus): void {
  const orders = getOrders().map(o => o.id === id ? { ...o, status } : o);
  localStorage.setItem("lobo_orders", JSON.stringify(orders));
}
