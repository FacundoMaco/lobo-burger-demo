// @vitest-environment node
// PAY-CREMAS-01: /api/charge debe rechazar cremas sobre categorias que no las
// admiten (deny-list, ver lib/menu.ts) y cremas duplicadas dentro del mismo
// item, sin llamar a Culqi en ninguno de los dos casos.

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

const BEBIDA_ID = 1015; // Coca-Cola 296ml, category: "Bebidas"
const HAMBURGUESA_ID = 1029; // Double Double, category: "Hamburguesas"

function bodyValido(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "tkn_test_123",
    email: "cliente@example.com",
    name: "Juan Perez",
    phone: "999999999",
    items: [{ id: HAMBURGUESA_ID, qty: 1 }],
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

let supabaseMock: ReturnType<typeof createSupabaseMock>;

beforeEach(() => {
  vi.mocked(getMenuItemLive).mockClear();
  vi.mocked(getMenuItemLive).mockImplementation(async (id: number) => CATALOGO_TEST.find((i) => i.id === id));

  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ id: "chr_test_1" }) }))
  );
  supabaseMock = createSupabaseMock({ insertResult: { data: { codigo: "LB-DEFAULT" }, error: null } });
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(supabaseMock.client as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/charge -- validacion de cremas (PAY-CREMAS-01)", () => {
  it("responde 400 si hay cremas sobre un item de categoria Bebidas, sin llamar a Culqi", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: BEBIDA_ID, qty: 1, cremas: ["Ketchup"] }] }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ese producto no lleva cremas" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si las cremas estan duplicadas dentro del mismo item, sin llamar a Culqi", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, cremas: ["Ketchup", "Ketchup"] }] }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cremas inválidas" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cobra y persiste normalmente cuando las cremas son legitimas sobre un item elegible", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, cremas: ["Ketchup", "Mayonesa"] }] }))
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/charges",
      expect.objectContaining({ method: "POST" })
    );
    const insertado = supabaseMock.calls.insertArgs[0];
    expect(insertado.items).toEqual([
      expect.objectContaining({ id: HAMBURGUESA_ID, cremas: ["Ketchup", "Mayonesa"] }),
    ]);
  });

  it("cremas ausente o vacia sobre una bebida sigue cobrando 200 sin campo cremas en el detalle", async () => {
    const resAusente = await POST(req(bodyValido({ items: [{ id: BEBIDA_ID, qty: 1 }] })));
    expect(resAusente.status).toBe(200);
    const insertadoAusente = supabaseMock.calls.insertArgs[0];
    expect(insertadoAusente.items).toEqual([
      expect.not.objectContaining({ cremas: expect.anything() }),
    ]);

    const resVacia = await POST(req(bodyValido({ items: [{ id: BEBIDA_ID, qty: 1, cremas: [] }] })));
    expect(resVacia.status).toBe(200);
    const insertadoVacio = supabaseMock.calls.insertArgs[1];
    expect(insertadoVacio.items).toEqual([
      expect.not.objectContaining({ cremas: expect.anything() }),
    ]);
  });

  it("preserva el rechazo existente por valores fuera de CREMAS_OPCIONES y por exceder CREMAS_MAX", async () => {
    const resInvalida = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, cremas: ["Salsa Inexistente"] }] }))
    );
    expect(resInvalida.status).toBe(400);
    expect(await resInvalida.json()).toEqual({ error: "Cremas inválidas" });

    const resExceso = await POST(
      req(
        bodyValido({
          items: [{ id: HAMBURGUESA_ID, qty: 1, cremas: ["Ketchup", "Mayonesa", "Mostaza", "Golf"] }],
        })
      )
    );
    expect(resExceso.status).toBe(400);
    expect(await resExceso.json()).toEqual({ error: "Cremas inválidas" });

    expect(fetch).not.toHaveBeenCalled();
  });
});
