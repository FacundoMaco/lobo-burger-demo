// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGO_TEST } from "./helpers/menu-data-mock";
import { createSupabaseMock } from "./helpers/supabase-mock";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/menu-data", () => ({
  getMenuItemLive: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase";
import { getMenuItemLive } from "@/lib/menu-data";
import { POST } from "@/app/api/charge/route";

function bodyValido(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "tkn_test_123",
    email: "cliente@example.com",
    name: "Juan Perez",
    phone: "999999999",
    items: [{ id: 1001, qty: 1 }],
    ...overrides,
  };
}

function req(body: unknown): Request {
  return new Request("http://localhost/api/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockCulqiCargoOk(cargo: Record<string, unknown> = {}) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ id: "chr_test_1", ...cargo }),
  } as Response);
}

function useSupabaseMock(
  insertResult: { data: { codigo: string } | null; error: { code?: string } | null }
) {
  const mock = createSupabaseMock({ insertResult });
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
  return mock;
}

describe("POST /api/charge -- precio vivo y agotado (MENU-04, OPS-04)", () => {
  beforeEach(() => {
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
    vi.stubGlobal("fetch", vi.fn());
    useSupabaseMock({ data: { codigo: "LB-DEFAULT" }, error: null });
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

  it("cobra amount: 3980 para 2 Enchiladas de Pollo (1790x2) + 1 Coca-Cola (400)", async () => {
    mockCulqiCargoOk();
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
  });

  it("rechaza con 400 y mensaje específico si un producto está agotado, sin tocar Culqi", async () => {
    const res = await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 1 },
            { id: 1020, qty: 1 }, // Lobo Sunset, agotado
          ],
        })
      )
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Un producto de tu pedido ya no está disponible",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si un producto no existe en el catálogo, sin tocar Culqi", async () => {
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

  it("llama a getMenuItemLive una vez por cada línea de pedido", async () => {
    mockCulqiCargoOk();
    await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 1 },
            { id: 1015, qty: 2 },
          ],
        })
      )
    );
    expect(getMenuItemLive).toHaveBeenCalledTimes(2);
    expect(getMenuItemLive).toHaveBeenNthCalledWith(1, 1001);
    expect(getMenuItemLive).toHaveBeenNthCalledWith(2, 1015);
  });

  it("guarda detalle en pedidos con id, name, price en soles y qty", async () => {
    mockCulqiCargoOk();
    const mock = useSupabaseMock({ data: { codigo: "LB-123" }, error: null });
    const res = await POST(
      req(
        bodyValido({
          items: [{ id: 1001, qty: 2 }],
        })
      )
    );
    expect(res.status).toBe(200);
    expect(mock.calls.table).toContain("pedidos");
    const insertCall = mock.calls.insertArgs[0] as Record<string, unknown>;
    expect(insertCall.items).toEqual([
      { id: 1001, name: "Enchilada de Pollo", price: 17.9, qty: 2 },
    ]);
  });
});
