// Modulo puro: sin "use client", sin React, sin DOM, sin import de
// lib/cart-context (evitaria un ciclo). Deriva el lineId que identifica cada
// linea del carrito (id + cremas normalizadas) y hace el merge/backfill sobre
// arrays de CartItem sin tocar ningun estado de React.

export type CartItem = {
  lineId: string;
  id: number;
  name: string;
  price: number;
  qty: number;
  cremas?: string[];
  pan?: string;
  papas?: string;
  comentario?: string;
};

// El orden en que el cliente toca los chips de cremas no debe crear una linea
// nueva: se ordena antes de armar el string para que "Ketchup, Aji" y
// "Aji, Ketchup" produzcan el mismo lineId. pan/papas/comentario se suman al
// final del string (no necesitan orden) para que una unidad con
// "Pan francés" y otra con "Pan de hamburguesa" -- o con distinto comentario
// libre -- del mismo item no se mezclen bajo el mismo qty.
export function cartLineId(id: number, cremas?: string[], pan?: string, papas?: string, comentario?: string): string {
  const cremasPart = cremas && cremas.length > 0 ? [...cremas].sort().join(",") : "";
  const panPart = pan ?? "";
  const papasPart = papas ?? "";
  const comentarioPart = comentario ?? "";
  if (!cremasPart && !panPart && !papasPart && !comentarioPart) return String(id);
  return `${id}|${cremasPart}|${panPart}|${papasPart}|${comentarioPart}`;
}

export function mergeIntoCart(
  prev: CartItem[],
  item: Omit<CartItem, "qty" | "lineId">
): CartItem[] {
  const lineId = cartLineId(item.id, item.cremas, item.pan, item.papas, item.comentario);
  const existing = prev.find((i) => i.lineId === lineId);
  if (existing) {
    return prev.map((i) => (i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i));
  }
  return [...prev, { ...item, lineId, qty: 1 }];
}

// Backfill de carritos guardados en localStorage antes de que existiera
// lineId. Descarta entradas malformadas y colapsa duplicados que terminen
// compartiendo lineId (por ejemplo, dos entradas viejas con mismo id y
// mismas cremas en distinto orden).
export function normalizarLineas(saved: unknown): CartItem[] {
  if (!Array.isArray(saved)) return [];

  const result: CartItem[] = [];
  for (const raw of saved) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "number" || typeof r.price !== "number" || typeof r.qty !== "number") {
      continue;
    }
    const cremas = Array.isArray(r.cremas) ? (r.cremas as string[]) : undefined;
    const pan = typeof r.pan === "string" ? r.pan : undefined;
    const papas = typeof r.papas === "string" ? r.papas : undefined;
    const comentario = typeof r.comentario === "string" ? r.comentario : undefined;
    const lineId = typeof r.lineId === "string" ? r.lineId : cartLineId(r.id, cremas, pan, papas, comentario);
    const existing = result.find((i) => i.lineId === lineId);
    if (existing) {
      existing.qty += r.qty;
      continue;
    }
    result.push({
      lineId,
      id: r.id,
      name: typeof r.name === "string" ? r.name : "",
      price: r.price,
      qty: r.qty,
      cremas,
      pan,
      papas,
      comentario,
    });
  }
  return result;
}
