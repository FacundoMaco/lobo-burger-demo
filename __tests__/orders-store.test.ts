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

  it("congela el string completo del flujo cliente (sin opts)", () => {
    const order = construirOrderLocal(baseInput);
    const expectedMsg =
      `Pedido Lobo Burger - #${order.id}\n\n` +
      `Cliente: Juan Perez\n` +
      `Telefono: 987654321\n` +
      `Delivery a: Av. Los Heroes 123\n\n` +
      `- 2x Miami Night - S/36.00\n` +
      `- 1x Salchipapa Clasica - S/10.00\n\n` +
      `Total: S/46.00`;
    const expectedUrl = `https://wa.me/51974983862?text=${encodeURIComponent(expectedMsg)}`;
    expect(buildWhatsAppUrl(order)).toBe(expectedUrl);
  });

  it("buildWhatsAppUrl(order, {}) es identico a buildWhatsAppUrl(order)", () => {
    const order = construirOrderLocal(baseInput);
    expect(buildWhatsAppUrl(order, {})).toBe(buildWhatsAppUrl(order));
  });

  it("con opts.to cambia solo el host del link, el texto decodificado es identico al default", () => {
    const order = construirOrderLocal(baseInput);
    const defaultUrl = buildWhatsAppUrl(order);
    const forwardedUrl = buildWhatsAppUrl(order, { to: "51923368745" });
    expect(forwardedUrl.startsWith("https://wa.me/51923368745?text=")).toBe(true);
    const defaultText = decodeURIComponent(defaultUrl.split("?text=")[1]);
    const forwardedText = decodeURIComponent(forwardedUrl.split("?text=")[1]);
    expect(forwardedText).toBe(defaultText);
  });

  it("con includeGps:true y lat/lng agrega la linea GPS sin cambiar el resto del texto", () => {
    const orderSinGps = construirOrderLocal(baseInput);
    const orderConLatLng = { ...orderSinGps, lat: -12.046374, lng: -77.042793 };
    const textoSinGps = decodeURIComponent(buildWhatsAppUrl(orderSinGps).split("?text=")[1]);
    const textoConGps = decodeURIComponent(buildWhatsAppUrl(orderConLatLng, { includeGps: true }).split("?text=")[1]);
    expect(textoConGps).toBe(textoSinGps.replace(
      "Delivery a: Av. Los Heroes 123\n\n",
      "Delivery a: Av. Los Heroes 123\nGPS: https://maps.google.com/?q=-12.046374,-77.042793\n\n"
    ));
  });

  it("con includeGps:true pero sin lat/lng no agrega 'GPS:' ni 'undefined'", () => {
    const order = construirOrderLocal(baseInput);
    const text = decodeURIComponent(buildWhatsAppUrl(order, { includeGps: true }).split("?text=")[1]);
    expect(text).not.toContain("GPS:");
    expect(text).not.toContain("undefined");
  });

  it("sin opts, un pedido con lat/lng no incluye 'GPS:'", () => {
    const orderSinGps = construirOrderLocal(baseInput);
    const orderConLatLng = { ...orderSinGps, lat: -12.046374, lng: -77.042793 };
    const text = decodeURIComponent(buildWhatsAppUrl(orderConLatLng).split("?text=")[1]);
    expect(text).not.toContain("GPS:");
  });

  it("mantiene el formato ' (Ají, Tártara)' para items con cremas", () => {
    const order = construirOrderLocal({
      ...baseInput,
      items: [{ id: 1, name: "Miami Night", price: 18, qty: 1, cremas: ["Ají", "Tártara"] }],
      total: 18,
    });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain("1x Miami Night (Ají, Tártara) - S/18");
  });

  it("incluye pan y papas junto con las cremas en un solo parentesis", () => {
    const order = construirOrderLocal({
      ...baseInput,
      items: [{
        id: 5, name: "Burgazo", price: 28, qty: 1,
        cremas: ["Ketchup"], pan: "Pan francés", papas: "Fritas",
      }],
      total: 28,
    });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain("1x Burgazo (Ketchup, Pan francés, Fritas) - S/28");
  });

  it("items sin cremas ni pan/papas no agregan parentesis vacio", () => {
    const order = construirOrderLocal({
      ...baseInput,
      items: [{ id: 10, name: "Gaseosa", price: 5, qty: 1 }],
      total: 5,
    });
    const text = decodeURIComponent(buildWhatsAppUrl(order).split("?text=")[1]);
    expect(text).toContain("1x Gaseosa - S/5");
    expect(text).not.toContain("()");
  });
});
