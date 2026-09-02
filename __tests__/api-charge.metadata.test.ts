// @vitest-environment node
// PAY-02 (opcion C, checkpoint Task 2 del plan 01-07): /api/charge manda el
// detalle minimo del pedido en el metadata del cargo de Culqi, para que el
// webhook (01-07) pueda reconstruir el pedido si el navegador nunca llega a
// llamar esta ruta. RED primero, contra el handler que todavia no manda
// metadata.
//
// Deliberadamente NO se manda el objeto entero del carrito ni nombres de
// producto: el limite de tamano del metadata de Culqi no esta confirmado
// (01-CULQI-FLUJO.md no existe todavia, PAY-01 sigue PARCIAL).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabase-mock";

vi.mock("@/lib/menu-data", () => ({
  getMenuItemLive: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase";
import { getMenuItemLive } from "@/lib/menu-data";
import { CATALOGO_TEST } from "./helpers/menu-data-mock";
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
    body: JSON.stringify(body),
  });
}

function mockCulqiCargoOk(cargo: Record<string, unknown> = {}) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ id: "chr_test_1", ...cargo }),
  } as Response);
}

beforeEach(() => {
  vi.mocked(getMenuItemLive).mockClear();
  vi.mocked(getMenuItemLive).mockImplementation(async (id: number) => CATALOGO_TEST.find((i) => i.id === id));

  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", vi.fn());
  const mock = createSupabaseMock({ insertResult: { data: { codigo: "LB-X" }, error: null } });
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/charge -- metadata para el webhook (opcion C, PAY-02)", () => {
  it("manda metadata.pedido como string JSON con items (solo id+qty), nombre, telefono, delivery:false, direccion:null", async () => {
    mockCulqiCargoOk();
    await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 2 },
            { id: 1015, qty: 1 },
          ],
        })
      )
    );

    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    expect(typeof culqiBody.metadata?.pedido).toBe("string");

    const pedido = JSON.parse(culqiBody.metadata.pedido);
    expect(pedido).toEqual({
      items: [
        { id: 1001, qty: 2 },
        { id: 1015, qty: 1 },
      ],
      nombre: "Juan Perez",
      telefono: "999999999",
      delivery: false,
      direccion: null,
    });
  });

  it("con delivery:true incluye la direccion trimmeada en la metadata", async () => {
    mockCulqiCargoOk();
    await POST(req(bodyValido({ delivery: true, address: "  Av. Siempre Viva 742  " })));

    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    const pedido = JSON.parse(culqiBody.metadata.pedido);
    expect(pedido.delivery).toBe(true);
    expect(pedido.direccion).toBe("Av. Siempre Viva 742");
  });

  it("la metadata NO incluye nombres de producto (limite de tamano no confirmado)", async () => {
    mockCulqiCargoOk();
    await POST(req(bodyValido()));

    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    expect(culqiBody.metadata.pedido).not.toContain("Miami Night");
  });
});
