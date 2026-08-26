// Caracterizacion (D-25) del comportamiento ACTUAL de saveOrder/buildWhatsAppUrl
// ANTES de quitar la escritura en localStorage. lib/cart-context.tsx:104 corre
// en cada checkout real -- estos tests fijan la forma del objeto de
// confirmacion y del texto de WhatsApp para que el refactor no los rompa.
import { describe, expect, it, beforeEach } from "vitest";
import { saveOrder } from "@/lib/orders-store";
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

describe("saveOrder (comportamiento actual)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("devuelve un objeto con todos los campos de entrada preservados", () => {
    const order = saveOrder(baseInput);
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
    const order = saveOrder(baseInput);
    expect(order.id.startsWith("LB-")).toBe(true);
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect(order.status).toBe("pendiente");
  });
});

describe("buildWhatsAppUrl (comportamiento actual)", () => {
  it("produce una URL a wa.me con el texto correcto", () => {
    const order = saveOrder(baseInput);
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
    const order = saveOrder({ ...baseInput, delivery: true });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain(`Delivery a: ${baseInput.address}`);
  });

  it("con delivery:false el texto contiene 'Para recoger'", () => {
    const order = saveOrder({ ...baseInput, delivery: false });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain("Para recoger");
  });
});
