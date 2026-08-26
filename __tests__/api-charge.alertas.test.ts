// @vitest-environment node
// Cablea PAY-05: un cargo cobrado cuyo insert falla dispara alertaTelegram.
// Reusa el mock de Supabase de 01-01 (__tests__/helpers/supabase-mock.ts) y
// el patron de mocking de fetch/env de api-charge.caracterizacion.test.ts.
// La caracterizacion de 01-01 (__tests__/api-charge.caracterizacion.test.ts)
// es la red de esta tarea y NO se modifica.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabase-mock";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/alertas", () => ({
  alertaTelegram: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase";
import { alertaTelegram } from "@/lib/alertas";
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
  insertResult: { data: { codigo: string } | null; error: { code?: string } | null },
  selectEqResult?: { data: { codigo: string } | null; error: { code?: string } | null }
) {
  const mock = createSupabaseMock({ insertResult, selectEqResult });
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
  return mock;
}

beforeEach(() => {
  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(alertaTelegram).mockClear();
  useSupabaseMock({ data: { codigo: "LB-DEFAULT" }, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/charge -- alerta en fallo de insert (no 23505)", () => {
  it("dispara alertaTelegram una vez con cargo.id, codigo y total en soles; sigue devolviendo 200", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCulqiCargoOk({ id: "chr_fallo_insert_1" });
    useSupabaseMock({ data: null, error: { code: "42P01" } });

    const res = await POST(req(bodyValido()));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chargeId).toBe("chr_fallo_insert_1");

    expect(alertaTelegram).toHaveBeenCalledTimes(1);
    const [mensaje] = vi.mocked(alertaTelegram).mock.calls[0];
    expect(mensaje).toContain("chr_fallo_insert_1");
    expect(mensaje).toContain(json.codigo);
    expect(mensaje).toContain(String(json.total));
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("POST /api/charge -- alerta en excepcion de getSupabaseAdmin()", () => {
  it("dispara alertaTelegram una vez con cargo.id; sigue devolviendo 200", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCulqiCargoOk({ id: "chr_excepcion_1" });
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    });

    const res = await POST(req(bodyValido()));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chargeId).toBe("chr_excepcion_1");

    expect(alertaTelegram).toHaveBeenCalledTimes(1);
    const [mensaje] = vi.mocked(alertaTelegram).mock.calls[0];
    expect(mensaje).toContain("chr_excepcion_1");
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("POST /api/charge -- 23505 NO dispara alerta (falso positivo a evitar)", () => {
  it("idempotencia: alertaTelegram no fue llamada", async () => {
    mockCulqiCargoOk({ id: "chr_dup_1" });
    useSupabaseMock(
      { data: null, error: { code: "23505" } },
      { data: { codigo: "LB-PREVIO" }, error: null }
    );

    const res = await POST(req(bodyValido()));

    expect(res.status).toBe(200);
    expect(alertaTelegram).not.toHaveBeenCalled();
  });
});

describe("POST /api/charge -- camino feliz", () => {
  it("insert exitoso: alertaTelegram no fue llamada", async () => {
    mockCulqiCargoOk({ id: "chr_feliz_1" });
    useSupabaseMock({ data: { codigo: "LB-X" }, error: null });

    const res = await POST(req(bodyValido()));

    expect(res.status).toBe(200);
    expect(alertaTelegram).not.toHaveBeenCalled();
  });
});
