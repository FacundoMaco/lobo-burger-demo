// @vitest-environment node
// /api/charge debe rechazar pan/papas sobre categorias que no las admiten
// (allow-list, solo Hamburguesas, ver lib/menu.ts) y valores fuera de
// PAN_OPCIONES/PAPAS_OPCIONES, sin llamar a Culqi en ninguno de los dos casos.

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

const ENCHILADA_ID = 1001; // Enchilada de Pollo, category: "Enchiladas"
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

describe("POST /api/charge -- validacion de pan/papas", () => {
  it("responde 400 si hay pan sobre un item que no es Hamburguesas, sin llamar a Culqi", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: ENCHILADA_ID, qty: 1, pan: "Pan francés" }] }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ese producto no tiene opciones de pan ni papas" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si hay papas sobre un item que no es Hamburguesas, sin llamar a Culqi", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: ENCHILADA_ID, qty: 1, papas: "Al hilo" }] }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ese producto no tiene opciones de pan ni papas" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si el valor de pan no esta en PAN_OPCIONES", () => {
    return POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, pan: "Pan de molde" }] }))
    ).then(async (res) => {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Tipo de pan inválido" });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("responde 400 si el valor de papas no esta en PAPAS_OPCIONES", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, papas: "Puré" }] }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Tipo de papas inválido" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cobra y persiste normalmente cuando pan/papas son legitimos sobre un item elegible", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, pan: "Pan francés", papas: "Fritas" }] }))
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/charges",
      expect.objectContaining({ method: "POST" })
    );
    const insertado = supabaseMock.calls.insertArgs[0];
    expect(insertado.items).toEqual([
      expect.objectContaining({ id: HAMBURGUESA_ID, pan: "Pan francés", papas: "Fritas" }),
    ]);
  });

  it("pan/papas ausentes sobre una hamburguesa siguen cobrando 200 sin esos campos en el detalle", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1 }] })));
    expect(res.status).toBe(200);
    const insertado = supabaseMock.calls.insertArgs[0];
    expect(insertado.items).toEqual([
      expect.not.objectContaining({ pan: expect.anything(), papas: expect.anything() }),
    ]);
  });
});
