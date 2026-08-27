// @vitest-environment node
// PAY-06: el rate limit va ANTES de todo lo demas -- antes del chequeo de
// tipos, de la validacion de formato (01-05), del recalculo de precio y del
// fetch a Culqi. RED primero, contra el handler actual que todavia no
// cuenta intentos.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabase-mock";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/alertas", () => ({
  alertaTelegram: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase";
import { POST } from "@/app/api/charge/route";

function bodyValido(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: "tkn_test_123",
    email: "cliente@example.com",
    name: "Juan Perez",
    phone: "999999999",
    items: [{ id: 1, qty: 1 }], // Miami Night, S/18
    ...overrides,
  };
}

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function mockCulqiCargoOk(cargo: Record<string, unknown> = {}) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ id: "chr_test_1", ...cargo }),
  } as Response);
}

function useSupabaseMock(rpcResults: { data: number | null; error: { message?: string } | null }[]) {
  const mock = createSupabaseMock({
    insertResult: { data: { codigo: "LB-DEFAULT" }, error: null },
    rpcResults,
  });
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
  return mock;
}

beforeEach(() => {
  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/charge -- rate limit por IP (PAY-06)", () => {
  it("con el contador por debajo del limite, el request procede normalmente", async () => {
    mockCulqiCargoOk();
    useSupabaseMock([{ data: 3, error: null }]); // muy por debajo de LIMITE_INTENTOS=10
    const res = await POST(req(bodyValido(), { "x-forwarded-for": "190.1.2.3" }));
    expect(res.status).toBe(200);
  });

  it("con el contador por encima del limite, responde 429", async () => {
    mockCulqiCargoOk();
    useSupabaseMock([{ data: 11, error: null }]); // por encima de LIMITE_INTENTOS=10
    const res = await POST(req(bodyValido(), { "x-forwarded-for": "190.1.2.3" }));
    expect(res.status).toBe(429);
  });

  it("en el caso 429, NUNCA se llama a fetch contra api.culqi.com/v2/charges", async () => {
    mockCulqiCargoOk();
    useSupabaseMock([{ data: 11, error: null }]);
    await POST(req(bodyValido(), { "x-forwarded-for": "190.1.2.3" }));
    const llamadasACulqi = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).includes("api.culqi.com/v2/charges"));
    expect(llamadasACulqi.length).toBe(0);
  });

  it("requests desde IPs distintas se cuentan por separado -- el p_ip que llega al RPC es el esperado", async () => {
    mockCulqiCargoOk();
    const mock = useSupabaseMock([
      { data: 1, error: null },
      { data: 1, error: null },
    ]);
    await POST(req(bodyValido(), { "x-forwarded-for": "190.1.2.3" }));
    await POST(req(bodyValido(), { "x-forwarded-for": "200.9.8.7" }));
    expect(mock.calls.rpcArgs[0].params).toMatchObject({ p_ip: "190.1.2.3" });
    expect(mock.calls.rpcArgs[1].params).toMatchObject({ p_ip: "200.9.8.7" });
  });

  it("x-forwarded-for con formato de lista usa la primera IP", async () => {
    mockCulqiCargoOk();
    const mock = useSupabaseMock([{ data: 1, error: null }]);
    await POST(req(bodyValido(), { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }));
    expect(mock.calls.rpcArgs[0].params).toMatchObject({ p_ip: "1.2.3.4" });
  });

  it("el mensaje del 429 no revela el limite exacto ni los intentos restantes", async () => {
    useSupabaseMock([{ data: 11, error: null }]);
    const res = await POST(req(bodyValido(), { "x-forwarded-for": "190.1.2.3" }));
    const json = await res.json();
    expect(json.error).not.toMatch(/[0-9]/);
  });
});
