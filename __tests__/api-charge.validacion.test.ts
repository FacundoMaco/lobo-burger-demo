// @vitest-environment node
// PAY-07: el handler debe rechazar formato invalido de email/telefono ANTES
// de tocar Culqi. RED primero, contra el handler actual que solo verifica
// typeof (no formato).

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
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(getMenuItemLive).mockClear();
  vi.mocked(getMenuItemLive).mockImplementation(async (id: number) => CATALOGO_TEST.find((i) => i.id === id));

  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", vi.fn());
  const mock = createSupabaseMock({ insertResult: { data: { codigo: "LB-DEFAULT" }, error: null } });
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/charge -- validacion de formato de email y telefono (PAY-07)", () => {
  it("responde 400 si el email tiene formato invalido, sin llamar a Culqi", async () => {
    const res = await POST(req(bodyValido({ email: "asdf" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El correo no tiene un formato válido" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si el telefono tiene formato invalido, sin llamar a Culqi", async () => {
    const res = await POST(req(bodyValido({ phone: "123" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "El teléfono debe tener 9 dígitos y empezar en 9",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("nunca llama a fetch contra api.culqi.com/v2/charges con datos invalidos", async () => {
    await POST(req(bodyValido({ email: "asdf" })));
    await POST(req(bodyValido({ phone: "123" })));
    const llamadasACulqi = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes("api.culqi.com/v2/charges"));
    expect(llamadasACulqi.length).toBe(0);
  });
});
