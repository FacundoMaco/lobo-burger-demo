"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { saveOrder } from "@/lib/orders-store";

export type CartItem = {
  id: number;
  name: string;
  price: number;
  qty: number;
};

type CartContextType = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">) => void;
  remove: (id: number) => void;
  update: (id: number, qty: number) => void;
  total: number;
  count: number;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  submitOrder: (data: { name: string; phone: string; delivery: boolean; address: string }) => void;
};

const CartContext = createContext<CartContextType | null>(null);

const WHATSAPP_NUMBER = "51999999999";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

  const add = (item: Omit<CartItem, "qty">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  const update = (id: number, qty: number) => {
    if (qty <= 0) return remove(id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const clear = () => setItems([]);

  const submitOrder = (data: { name: string; phone: string; delivery: boolean; address: string }) => {
    const order = saveOrder({
      ...data,
      items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      total,
    });

    const lines = items.map(i => `- ${i.qty}x ${i.name} - S/${i.price * i.qty}`).join("\n");
    const deliveryLine = data.delivery ? `Delivery a: ${data.address}` : "Para recoger";
    const msg = `Pedido Lobo Burger - #${order.id}\n\nCliente: ${data.name}\nTelefono: ${data.phone}\n${deliveryLine}\n\n${lines}\n\nTotal: S/${total}`;

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
    clear();
    setOpen(false);
  };

  return (
    <CartContext.Provider value={{ items, add, remove, update, total, count, clear, open, setOpen, submitOrder }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
