import { describe, expect, it } from "vitest";
import { cartLineId, mergeIntoCart, normalizarLineas, type CartItem } from "@/lib/cart-line";

describe("cartLineId", () => {
  it("sin cremas devuelve el id como string", () => {
    expect(cartLineId(13)).toBe("13");
  });

  it("array vacio de cremas equivale a sin cremas", () => {
    expect(cartLineId(13, [])).toBe("13");
  });

  it("el orden de seleccion de cremas no crea lineas distintas", () => {
    expect(cartLineId(13, ["Ketchup", "Ají"])).toBe(cartLineId(13, ["Ají", "Ketchup"]));
  });

  it("distinto set de cremas produce distinto lineId", () => {
    expect(cartLineId(13, ["Ketchup"])).not.toBe(cartLineId(13, ["Ketchup", "Ají"]));
  });

  it("distinto id produce distinto lineId aunque las cremas sean iguales", () => {
    expect(cartLineId(13, ["Ketchup"])).not.toBe(cartLineId(14, ["Ketchup"]));
  });

  it("distinto pan produce distinto lineId con las mismas cremas", () => {
    expect(cartLineId(5, ["Ketchup"], "Pan de hamburguesa")).not.toBe(
      cartLineId(5, ["Ketchup"], "Pan francés")
    );
  });

  it("distintas papas producen distinto lineId con el mismo pan", () => {
    expect(cartLineId(5, [], "Pan francés", "Fritas")).not.toBe(
      cartLineId(5, [], "Pan francés", "Al hilo")
    );
  });

  it("mismo pan y papas producen el mismo lineId", () => {
    expect(cartLineId(5, [], "Pan de hamburguesa", "Al hilo")).toBe(
      cartLineId(5, [], "Pan de hamburguesa", "Al hilo")
    );
  });
});

describe("mergeIntoCart", () => {
  const base = { id: 13, name: "Combo Lobo", price: 25 };

  it("agrega la linea con qty 1 y su lineId cuando el carrito esta vacio", () => {
    const result = mergeIntoCart([], base);
    expect(result).toEqual([{ ...base, lineId: "13", qty: 1 }]);
  });

  it("incrementa qty de la linea existente sin agregar una nueva", () => {
    const prev: CartItem[] = [{ ...base, lineId: "13", qty: 1 }];
    const result = mergeIntoCart(prev, base);
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(2);
  });

  it("mantiene intacto y en el mismo orden el resto del array al mergear", () => {
    const prev: CartItem[] = [
      { id: 1, name: "Miami Night", price: 18, lineId: "1", qty: 1 },
      { ...base, lineId: "13", qty: 1 },
      { id: 2, name: "Doble Carne", price: 24, lineId: "2", qty: 1 },
    ];
    const result = mergeIntoCart(prev, base);
    expect(result[0]).toEqual(prev[0]);
    expect(result[2]).toEqual(prev[2]);
    expect(result[1].qty).toBe(2);
  });

  it("mismas cremas en distinto orden mergean en la linea existente", () => {
    const conCremas = { id: 2, name: "Doble Carne", price: 24, cremas: ["Ketchup", "Ají"] };
    const prev = mergeIntoCart([], conCremas);
    const result = mergeIntoCart(prev, { ...conCremas, cremas: ["Ají", "Ketchup"] });
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(2);
  });

  it("cremas distintas agregan una segunda linea con el mismo id", () => {
    const conKetchup = { id: 2, name: "Doble Carne", price: 24, cremas: ["Ketchup"] };
    const conAji = { id: 2, name: "Doble Carne", price: 24, cremas: ["Ají"] };
    const prev = mergeIntoCart([], conKetchup);
    const result = mergeIntoCart(prev, conAji);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(2);
    expect(result[0].lineId).not.toBe(result[1].lineId);
  });

  it("mismo pan/papas mergean en la linea existente", () => {
    const conPan = { id: 5, name: "Burgazo", price: 28, pan: "Pan francés", papas: "Fritas" };
    const prev = mergeIntoCart([], conPan);
    const result = mergeIntoCart(prev, { ...conPan });
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(2);
  });

  it("distinto pan agrega una segunda linea con el mismo id", () => {
    const conPanClasico = { id: 5, name: "Burgazo", price: 28, pan: "Pan de hamburguesa" };
    const conPanFrances = { id: 5, name: "Burgazo", price: 28, pan: "Pan francés" };
    const prev = mergeIntoCart([], conPanClasico);
    const result = mergeIntoCart(prev, conPanFrances);
    expect(result).toHaveLength(2);
  });

  it("dos items sin cremas del mismo id mergean (paridad con Bebidas / promo-slider)", () => {
    const gaseosa = { id: 10, name: "Gaseosa", price: 5 };
    const prev = mergeIntoCart([], gaseosa);
    const result = mergeIntoCart(prev, gaseosa);
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(2);
  });

  it("es puro: no muta el array de entrada", () => {
    const prev: CartItem[] = [{ ...base, lineId: "13", qty: 1 }];
    const snapshot = JSON.parse(JSON.stringify(prev));
    mergeIntoCart(prev, base);
    expect(prev).toEqual(snapshot);
  });
});

describe("normalizarLineas", () => {
  it("le pone lineId a items guardados que no lo tienen", () => {
    const saved = [{ id: 13, name: "Combo Lobo", price: 25, qty: 1 }];
    const result = normalizarLineas(saved);
    expect(result).toEqual([{ id: 13, name: "Combo Lobo", price: 25, qty: 1, lineId: "13", cremas: undefined }]);
  });

  it("deriva el lineId de id + cremas cuando falta", () => {
    const saved = [{ id: 2, name: "Doble Carne", price: 24, qty: 1, cremas: ["Ketchup", "Ají"] }];
    const result = normalizarLineas(saved);
    expect(result[0].lineId).toBe(cartLineId(2, ["Ketchup", "Ají"]));
  });

  it("deriva el lineId incluyendo pan/papas cuando falta", () => {
    const saved = [{ id: 5, name: "Burgazo", price: 28, qty: 1, pan: "Pan francés", papas: "Fritas" }];
    const result = normalizarLineas(saved);
    expect(result[0].lineId).toBe(cartLineId(5, undefined, "Pan francés", "Fritas"));
    expect(result[0].pan).toBe("Pan francés");
    expect(result[0].papas).toBe("Fritas");
  });

  it("colapsa duplicados que terminen con el mismo lineId", () => {
    const saved = [
      { id: 10, name: "Gaseosa", price: 5, qty: 1 },
      { id: 10, name: "Gaseosa", price: 5, qty: 1 },
    ];
    const result = normalizarLineas(saved);
    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(2);
  });

  it("descarta entradas malformadas sin id/price/qty numericos", () => {
    const saved = [
      { id: 13, name: "Combo Lobo", price: 25, qty: 1 },
      { id: "no-es-numero", name: "Roto", price: 25, qty: 1 },
      { name: "Sin id", price: 25, qty: 1 },
      null,
      "no-es-objeto",
    ];
    const result = normalizarLineas(saved);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(13);
  });

  it("devuelve array vacio si no recibe un array", () => {
    expect(normalizarLineas(undefined)).toEqual([]);
    expect(normalizarLineas({})).toEqual([]);
    expect(normalizarLineas(null)).toEqual([]);
  });
});
