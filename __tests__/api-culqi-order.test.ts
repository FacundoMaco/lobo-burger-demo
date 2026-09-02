// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGO_TEST } from "./helpers/menu-data-mock";

vi.mock("@/lib/menu-data", () => ({
  getMenuItemLive: vi.fn(),
}));

import { getMenuItemLive } from "@/lib/menu-data";
import { POST } from "@/app/api/culqi/order/route";

function bodyValido(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ id: 1001, qty: 1 }],
    name: "Juan Perez",
    phone: "999999999",
    email: "cliente@example.com",
    ...overrides,
  };
}

function req(body: unknown): Request {
  return new Request("http://localhost/api/culqi/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockCulqiOrderOk(orderId = "ord_test_123") {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ id: orderId }),
  } as Response);
}

describe("POST /api/culqi/order -- precio vivo y agotado (MENU-04, OPS-04)", () => {
  beforeEach(() => {
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(getMenuItemLive).mockClear();
    vi.mocked(getMenuItemLive).mockImplementation(async (id: number) => {
      return CATALOGO_TEST.find((i) => i.id === id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("produce amount: 3980 para 2 Enchiladas (1790x2) + 1 Coca-Cola (400)", async () => {
    mockCulqiOrderOk();
    const res = await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 2 },
            { id: 1015, qty: 1 },
          ],
        })
      )
    );
    expect(res.status).toBe(200);
    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    expect(culqiBody.amount).toBe(3980);
    expect(await res.json()).toEqual({ orderId: "ord_test_123", amount: 3980 });
  });

  it("responde 400 si incluye un producto agotado sin llamar a fetch", async () => {
    const res = await POST(
      req(
        bodyValido({
          items: [{ id: 1020, qty: 1 }], // Lobo Sunset agotado
        })
      )
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Un producto de tu pedido ya no está disponible",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si el monto es menor que MIN_CENTS (600)", async () => {
    const res = await POST(
      req(
        bodyValido({
          items: [{ id: 1021, qty: 1 }], // Agua San Luis: 350 < 600
        })
      )
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "El monto del pedido no es válido",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si un producto no existe en el catálogo", async () => {
    const res = await POST(
      req(
        bodyValido({
          items: [{ id: 9999, qty: 1 }],
        })
      )
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Hay un producto que ya no está disponible",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 500 si falta CULQI_SECRET_KEY", async () => {
    vi.stubEnv("CULQI_SECRET_KEY", "");
    const res = await POST(req(bodyValido()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Pasarela no configurada" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
