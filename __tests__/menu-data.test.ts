// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks obligatorios de entorno
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { createSupabaseMock } from "./helpers/supabase-mock";

let mockClient: any;
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => mockClient,
}));

import { getMenuItemsCached, getMenuItemLive, updateMenuItem } from "@/lib/menu-data";

describe("lib/menu-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMenuItemsCached", () => {
    it("mapea precio_centimos a price y respeta el orden de category e id", async () => {
      const rows = [
        {
          id: 1001,
          category: "Enchiladas",
          name: "Enchilada de Pollo",
          description: "pollo deshilachado",
          precio_centimos: 1790,
          original_price_centimos: null,
          badge: null,
          image: null,
          agotado: false,
        },
      ];

      const { client, calls } = createSupabaseMock({
        selectOrderResult: { data: rows, error: null },
      });
      mockClient = client;

      const items = await getMenuItemsCached();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(1001);
      expect(items[0].price).toBe(17.9);
      expect(items[0].originalPrice).toBeNull();
      expect(items[0].agotado).toBe(false);

      expect(calls.table).toContain("menu_items");
      expect(calls.selectOrderArgs).toEqual(["category", "id"]);
    });

    it("propaga el error si Supabase falla", async () => {
      const { client } = createSupabaseMock({
        selectOrderResult: { data: null, error: { message: "DB Error" } },
      });
      mockClient = client;

      await expect(getMenuItemsCached()).rejects.toEqual({ message: "DB Error" });
    });
  });

  describe("getMenuItemLive", () => {
    it("devuelve el precio_centimos crudo y estado agotado sin cachear", async () => {
      const row = { id: 1001, precio_centimos: 1790, agotado: false };
      const { client, calls } = createSupabaseMock({
        selectEqResult: { data: row, error: null },
      });
      mockClient = client;

      const res = await getMenuItemLive(1001);
      expect(res).toEqual({ id: 1001, precio_centimos: 1790, agotado: false });
      expect(calls.selectEqArgs).toContainEqual({ column: "id", value: 1001 });
    });

    it("devuelve undefined si la fila no existe o hay error", async () => {
      const { client } = createSupabaseMock({
        selectEqResult: { data: null, error: { message: "No data" } },
      });
      mockClient = client;

      const res = await getMenuItemLive(9999);
      expect(res).toBeUndefined();
    });
  });

  describe("updateMenuItem", () => {
    it("llama a update, eq y luego a revalidateTag con expire: 0", async () => {
      const { client, calls } = createSupabaseMock({
        updateResult: { error: null },
      });
      mockClient = client;

      await updateMenuItem(1001, { agotado: true });

      expect(calls.table).toContain("menu_items");
      expect(calls.updateArgs).toContainEqual({ agotado: true });
      expect(calls.updateEqArgs).toContainEqual({ column: "id", value: 1001 });
      expect(revalidateTag).toHaveBeenCalledWith("menu", { expire: 0 });
    });

    it("NO llama a revalidateTag si el update arroja un error", async () => {
      const { client } = createSupabaseMock({
        updateResult: { error: { message: "Update failed" } },
      });
      mockClient = client;

      await expect(updateMenuItem(1001, { precio_centimos: 2000 })).rejects.toEqual({
        message: "Update failed",
      });
      expect(revalidateTag).not.toHaveBeenCalled();
    });
  });
});
