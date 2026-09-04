// Smoke test: prueba que el runner arranca Y que el alias "@/*" resuelve
// dentro de Vitest. Sin vite-tsconfig-paths, este import no resuelve y toda
// la fase se cae -- por eso el import es via "@/lib/menu", nunca relativo.
import { describe, expect, it } from "vitest";
import { getMenuItem, MENU_ITEMS, CATEGORIAS_CON_CREMAS, categoriaAdmiteCremas } from "@/lib/menu";

describe("lib/menu", () => {
  it("getMenuItem(1) devuelve Miami Night a S/18", () => {
    const item = getMenuItem(1);
    expect(item?.name).toBe("Miami Night");
    expect(item?.price).toBe(18);
  });

  it("getMenuItem(999) devuelve undefined para un id que no existe", () => {
    expect(getMenuItem(999)).toBeUndefined();
  });

  it("MENU_ITEMS tiene ids unicos", () => {
    // Protege contra que un futuro duplicado en la carta haga que
    // getMenuItem devuelva el item equivocado en el recalculo de precio.
    const ids = MENU_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("categoriaAdmiteCremas", () => {
    it("es false para Bebidas (nombre presente en ambas taxonomias)", () => {
      expect(categoriaAdmiteCremas("Bebidas")).toBe(false);
    });

    it("es false (fail-closed) para undefined, null y string vacio", () => {
      expect(categoriaAdmiteCremas(undefined)).toBe(false);
      expect(categoriaAdmiteCremas(null)).toBe(false);
      expect(categoriaAdmiteCremas("")).toBe(false);
    });

    it("es true para toda categoria de CATEGORIAS_CON_CREMAS (invariante deny-list vs allow-list)", () => {
      for (const categoria of CATEGORIAS_CON_CREMAS) {
        expect(categoriaAdmiteCremas(categoria)).toBe(true);
      }
    });

    it("es true para las categorias reales de la DB distintas de Bebidas", () => {
      expect(categoriaAdmiteCremas("Enchiladas")).toBe(true);
      expect(categoriaAdmiteCremas("Broaster")).toBe(true);
      expect(categoriaAdmiteCremas("Salchipapas / Power Plates")).toBe(true);
      expect(categoriaAdmiteCremas("Combos xtremos")).toBe(true);
      expect(categoriaAdmiteCremas("Hamburguesas")).toBe(true);
    });
  });
});
