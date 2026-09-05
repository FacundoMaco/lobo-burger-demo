"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { formatPrice } from "@/lib/utils";
import { construirOrderLocal } from "@/lib/orders-store";
import type { Order } from "@/lib/orders-store";
import { mergeIntoCart, normalizarLineas } from "@/lib/cart-line";

export type { CartItem } from "@/lib/cart-line";
import type { CartItem } from "@/lib/cart-line";

export type FulfillmentMode = "pickup" | "delivery" | null;

type CartContextType = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty" | "lineId">) => void;
  remove: (lineId: string) => void;
  update: (lineId: string, qty: number) => void;
  total: number;
  count: number;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  fulfillmentMode: FulfillmentMode;
  setFulfillmentMode: (m: FulfillmentMode) => void;
  address: string;
  setAddress: (a: string) => void;
  submitOrder: (data: { name: string; phone: string; email?: string; culqiChargeId?: string; delivery: boolean; address: string }) => Order;
};

const CartContext = createContext<CartContextType | null>(null);

const WHATSAPP_NUMBER = "51974983862";

export function buildWhatsAppUrl(order: Order, opts?: { to?: string; includeGps?: boolean }): string {
  const to = opts?.to ?? WHATSAPP_NUMBER;
  const lines = order.items.map(i => {
    const detalle = [...(i.cremas ?? []), i.pan, i.papas].filter(Boolean).join(", ");
    return `- ${i.qty}x ${i.name}${detalle ? ` (${detalle})` : ""} - ${formatPrice(i.price * i.qty)}`;
  }).join("\n");
  const deliveryLine = order.delivery ? `Delivery a: ${order.address}` : "Para recoger";
  const gpsLine = opts?.includeGps && order.lat != null && order.lng != null
    ? `\nGPS: https://maps.google.com/?q=${order.lat},${order.lng}`
    : "";
  const msg = `Pedido Lobo Burger - #${order.id}\n\nCliente: ${order.name}\nTelefono: ${order.phone}\n${deliveryLine}${gpsLine}\n\n${lines}\n\nTotal: ${formatPrice(order.total)}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
}

const STORAGE_KEY = "lobo_cart_v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>(null);
  const [address, setAddress] = useState("");
  // Hasta leer localStorage no se escribe nada, para no pisar el carrito
  // guardado con el estado vacio del primer render.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.items)) setItems(normalizarLineas(saved.items));
        if (saved.fulfillmentMode === "pickup" || saved.fulfillmentMode === "delivery") {
          setFulfillmentMode(saved.fulfillmentMode);
        }
        if (typeof saved.address === "string") setAddress(saved.address);
      }
    } catch {
      // Carrito corrupto: se empieza de cero en vez de romper la pagina.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items, fulfillmentMode, address })
      );
    } catch {
      // Modo incognito o storage lleno: el carrito sigue funcionando en memoria.
    }
  }, [items, fulfillmentMode, address, hydrated]);

  const add = (item: Omit<CartItem, "qty" | "lineId">) => {
    setItems((prev) => mergeIntoCart(prev, item));
  };

  const remove = (lineId: string) => setItems((prev) => prev.filter((i) => i.lineId !== lineId));

  const update = (lineId: string, qty: number) => {
    if (qty <= 0) return remove(lineId);
    setItems((prev) => prev.map((i) => i.lineId === lineId ? { ...i, qty } : i));
  };

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const clear = () => setItems([]);

  const submitOrder = (data: { name: string; phone: string; email?: string; culqiChargeId?: string; delivery: boolean; address: string }): Order => {
    const order = construirOrderLocal({
      ...data,
      items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, cremas: i.cremas, pan: i.pan, papas: i.papas })),
      total,
    });
    clear();
    setOpen(false);
    return order;
  };

  return (
    <CartContext.Provider value={{
      items, add, remove, update, total, count, clear, open, setOpen,
      fulfillmentMode, setFulfillmentMode, address, setAddress, submitOrder,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
