// Smoke test: prueba que el runner arranca Y que el alias "@/*" resuelve
// dentro de Vitest. Sin vite-tsconfig-paths, este import no resuelve y toda
// la fase se cae -- por eso el import es via "@/lib/menu", nunca relativo.
import { describe, expect, it } from "vitest";
import { getMenuItem, MENU_ITEMS } from "@/lib/menu";

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
});
