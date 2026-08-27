// CLEAN-02: lib/orders-store.ts deja de escribir una copia muerta del
// pedido en localStorage["lobo_orders"] (nadie la lee desde el commit
// eb9f243, el panel lee de Supabase). construirOrderLocal reemplaza a
// saveOrder con la MISMA forma de entrada/salida pero sin persistencia --
// la garantia de que la confirmacion y buildWhatsAppUrl (respaldo
// operativo cuando el insert falla) no cambian.
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { construirOrderLocal } from "@/lib/orders-store";
import { buildWhatsAppUrl } from "@/lib/cart-context";

const baseInput = {
  name: "Juan Perez",
  phone: "987654321",
  email: "juan@example.com",
  culqiChargeId: "chr_test_123",
  delivery: true,
  address: "Av. Los Heroes 123",
  items: [
    { id: 1, name: "Miami Night", price: 18, qty: 2 },
    { id: 6, name: "Salchipapa Clasica", price: 10, qty: 1 },
  ],
  total: 46,
};

describe("construirOrderLocal (comportamiento nuevo -- sin persistencia)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("NO escribe en localStorage bajo la clave lobo_orders", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    construirOrderLocal(baseInput);
    expect(spy).not.toHaveBeenCalledWith("lobo_orders", expect.anything());
  });

  it("no toca la clave lobo_cart del carrito", () => {
    localStorage.setItem("lobo_cart", JSON.stringify({ items: [], fulfillmentMode: null, address: "" }));
    const before = localStorage.getItem("lobo_cart");
    construirOrderLocal(baseInput);
    expect(localStorage.getItem("lobo_cart")).toBe(before);
  });

  it("devuelve un objeto con todos los campos de entrada preservados", () => {
    const order = construirOrderLocal(baseInput);
    expect(order.name).toBe(baseInput.name);
    expect(order.phone).toBe(baseInput.phone);
    expect(order.email).toBe(baseInput.email);
    expect(order.culqiChargeId).toBe(baseInput.culqiChargeId);
    expect(order.delivery).toBe(baseInput.delivery);
    expect(order.address).toBe(baseInput.address);
    expect(order.items).toEqual(baseInput.items);
    expect(order.total).toBe(baseInput.total);
  });

  it("agrega id que empieza con LB-, createdAt ISO valido, y status pendiente", () => {
    const order = construirOrderLocal(baseInput);
    expect(order.id.startsWith("LB-")).toBe(true);
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect(order.status).toBe("pendiente");
  });
});

describe("buildWhatsAppUrl (comportamiento actual)", () => {
  it("produce una URL a wa.me con el texto correcto", () => {
    const order = construirOrderLocal(baseInput);
    const url = buildWhatsAppUrl(order);
    expect(url.startsWith("https://wa.me/51974983862?text=")).toBe(true);

    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toContain(order.id);
    expect(text).toContain(order.name);
    expect(text).toContain(order.phone);
    expect(text).toContain("2x Miami Night - S/36");
    expect(text).toContain("1x Salchipapa Clasica - S/10");
    expect(text).toContain(`Total: S/${order.total}`);
  });

  it("con delivery:true el texto contiene 'Delivery a: ' y la direccion", () => {
    const order = construirOrderLocal({ ...baseInput, delivery: true });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain(`Delivery a: ${baseInput.address}`);
  });

  it("con delivery:false el texto contiene 'Para recoger'", () => {
    const order = construirOrderLocal({ ...baseInput, delivery: false });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain("Para recoger");
  });
});
