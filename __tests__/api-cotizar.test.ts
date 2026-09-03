// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/menu-data", () => ({
  getMenuItemLive: vi.fn(),
}));

import { getMenuItemLive } from "@/lib/menu-data";
import { POST } from "@/app/api/cotizar/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/cotizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/cotizar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza peticiones con JSON inválido o items vacíos", async () => {
    const res1 = await POST(new Request("http://localhost/api/cotizar", { method: "POST", body: "invalid" }));
    expect(res1.status).toBe(400);

    const res2 = await POST(req({ items: [] }));
    expect(res2.status).toBe(400);
  });

  it("rechaza si algún item ya no existe en el catálogo", async () => {
    vi.mocked(getMenuItemLive).mockResolvedValueOnce(undefined);

    const res = await POST(req({ items: [{ id: 999, qty: 1 }] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("ya no está disponible");
  });

  it("rechaza si algún item está marcado como agotado", async () => {
    vi.mocked(getMenuItemLive).mockResolvedValueOnce({
      id: 1,
      name: "Hamburguesa Agotada",
      precio_centimos: 2000,
      agotado: true,
    });

    const res = await POST(req({ items: [{ id: 1, qty: 1 }] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("ya no está disponible");
  });

  it("calcula el totalCents exacto de la base de datos en vivo", async () => {
    vi.mocked(getMenuItemLive)
      .mockResolvedValueOnce({ id: 1, name: "Burger A", precio_centimos: 2000, agotado: false })
      .mockResolvedValueOnce({ id: 2, name: "Burger B", precio_centimos: 1500, agotado: false });

    const res = await POST(
      req({
        items: [
          { id: 1, qty: 2 },
          { id: 2, qty: 1 },
        ],
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalCents).toBe(5500); // 2000*2 + 1500*1
    expect(data.total).toBe(55);
  });
});
