// @vitest-environment node
// /api/charge debe validar el comentario libre del cliente por item: rechazar
// texto que exceda COMENTARIO_MAX_LENGTH y rechazar comentario sobre
// categorias que no lo admiten (misma cobertura que cremas, ver lib/menu.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabase-mock";
import { COMENTARIO_MAX_LENGTH } from "@/lib/menu";

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

describe("POST /api/charge -- validacion de comentario", () => {
  it("responde 400 si el comentario excede COMENTARIO_MAX_LENGTH, sin llamar a Culqi", async () => {
    const res = await POST(
      req(
        bodyValido({
          items: [{ id: HAMBURGUESA_ID, qty: 1, comentario: "x".repeat(COMENTARIO_MAX_LENGTH + 1) }],
        })
      )
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Comentario inválido" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si hay comentario sobre un item de categoria Bebidas, sin llamar a Culqi", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: BEBIDA_ID, qty: 1, comentario: "sin hielo" }] }))
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ese producto no admite comentario" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cobra y persiste normalmente cuando el comentario es legitimo sobre un item elegible", async () => {
    const res = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, comentario: "sin cebolla por favor" }] }))
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/charges",
      expect.objectContaining({ method: "POST" })
    );
    const insertado = supabaseMock.calls.insertArgs[0];
    expect(insertado.items).toEqual([
      expect.objectContaining({ id: HAMBURGUESA_ID, comentario: "sin cebolla por favor" }),
    ]);
  });

  it("comentario ausente o vacio no agrega campo comentario al detalle, y cobra 200", async () => {
    const resAusente = await POST(req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1 }] })));
    expect(resAusente.status).toBe(200);
    const insertadoAusente = supabaseMock.calls.insertArgs[0];
    expect(insertadoAusente.items).toEqual([
      expect.not.objectContaining({ comentario: expect.anything() }),
    ]);

    const resVacio = await POST(
      req(bodyValido({ items: [{ id: HAMBURGUESA_ID, qty: 1, comentario: "   " }] }))
    );
    expect(resVacio.status).toBe(200);
    const insertadoVacio = supabaseMock.calls.insertArgs[1];
    expect(insertadoVacio.items).toEqual([
      expect.not.objectContaining({ comentario: expect.anything() }),
    ]);
  });
});
