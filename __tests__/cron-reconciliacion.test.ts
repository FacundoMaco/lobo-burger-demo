// @vitest-environment node
// Cron diario (D-16): keep-warm real (INFRA-01) + reconciliacion de cargos
// huerfanos en Culqi (INFRA-02, D-12), en una sola pasada -- Vercel Hobby
// permite una unica ejecucion diaria. Ver 01-08-PLAN.md.
//
// Task 1 (casos 1 a 5): el gate de autorizacion con CRON_SECRET y el
// keep-warm real contra "pedidos".
//
// Task 2 (casos 6 a 10): reconciliacion de cargos huerfanos. Mockea fetch
// para la llamada de listado a Culqi (GET /v2/charges?limit=N -- unico
// parametro confirmable sin una CULQI_SECRET_KEY real, ver
// 01-CULQI-FLUJO.md), igual que __tests__/culqi-webhook.test.ts mockea el
// GET de un cargo individual.

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
import { GET } from "@/app/api/cron/reconciliacion/route";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/reconciliacion", { headers });
}

function useSupabaseMock(config: Parameters<typeof createSupabaseMock>[0] = {}) {
  const mock = createSupabaseMock(config);
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
  return mock;
}

// Todos los mensajes de alerta disparados en el test, en orden.
function mensajesDeAlerta(): string[] {
  return vi.mocked(alertaTelegram).mock.calls.map((c) => c[0]);
}

function mockListadoCulqi(respuesta: { ok: boolean; status?: number; json?: () => Promise<unknown> } | "reject") {
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (String(url).startsWith("https://api.culqi.com/v2/charges?")) {
      if (respuesta === "reject") throw new Error("network error");
      return respuesta as Response;
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

function listadoOk(cargos: { id: string; amount: number; email: string }[]) {
  return { ok: true, json: async () => ({ data: cargos }) };
}

beforeEach(() => {
  vi.mocked(alertaTelegram).mockClear();
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/cron/reconciliacion -- gate de autorizacion (T-01-41, T-01-42)", () => {
  it("caso 1: sin header Authorization -> 401, getSupabaseAdmin nunca se llama", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    useSupabaseMock();

    const res = await GET(req());

    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("caso 2: Bearer incorrecto -> 401, getSupabaseAdmin nunca se llama", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    useSupabaseMock();

    const res = await GET(req({ authorization: "Bearer un-valor-inventado" }));

    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("caso 3: sin CRON_SECRET configurado -> 401, falla cerrado igual que proxy.ts", async () => {
    vi.stubEnv("CRON_SECRET", "");
    useSupabaseMock();

    const res = await GET(req({ authorization: "Bearer cualquier-cosa" }));

    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/reconciliacion -- keep-warm real (INFRA-01, pitfall 13, D-14)", () => {
  it("caso 4: Bearer correcto -> ejecuta una query real contra pedidos (no solo un 200)", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    const mock = useSupabaseMock({ selectLimitResult: { data: [{ id: 1 }], error: null } });

    const res = await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    expect(res.status).toBe(200);
    expect(mock.calls.table).toContain("pedidos");
    expect(mock.calls.selectLimitArgs.length).toBeGreaterThan(0);
  });

  it("caso 5: la query a Supabase falla -> alerta con mensaje identificable y responde no-2xx", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    useSupabaseMock({
      selectLimitResult: { data: null, error: { code: "PGRST000", message: "timeout" } },
    });

    const res = await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    const esNo2xx = res.status < 200 || res.status >= 300;
    expect(esNo2xx).toBe(true);
    expect(alertaTelegram).toHaveBeenCalled();
    expect(mensajesDeAlerta().some((m) => m.toLowerCase().includes("no respondio"))).toBe(true);
  });

  it("caso 5b: getSupabaseAdmin() lanza (faltan credenciales) -> alerta distinguiendo config faltante, responde no-2xx", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    });

    const res = await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    const esNo2xx = res.status < 200 || res.status >= 300;
    expect(esNo2xx).toBe(true);
    expect(alertaTelegram).toHaveBeenCalled();
    expect(mensajesDeAlerta().some((m) => m.includes("credenciales"))).toBe(true);
  });
});

describe("GET /api/cron/reconciliacion -- reconciliacion de cargos huerfanos (INFRA-02, D-12)", () => {
  it("caso 6: todos los cargos tienen fila en pedidos -> consulta Culqi de verdad y NO alerta", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_cron");
    mockListadoCulqi(
      listadoOk([{ id: "chr_a", amount: 1000, email: "a@b.com" }])
    );
    useSupabaseMock({
      selectLimitResult: { data: [{ id: 1 }], error: null },
      selectEqResultByValue: { chr_a: { data: { codigo: "LB-1" }, error: null } },
    });

    const res = await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    expect(res.status).toBe(200);
    // Prueba que la consulta a Culqi ocurrio de verdad -- sin esto el test
    // pasaria igual con una reconciliacion que nunca corre.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.culqi.com/v2/charges?"),
      expect.anything()
    );
    expect(alertaTelegram).not.toHaveBeenCalled();
  });

  it("caso 7+8: un cargo sin fila -> alerta con chargeId y monto, y nunca escribe en pedidos (D-12)", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_cron");
    mockListadoCulqi(
      listadoOk([{ id: "chr_huerfano", amount: 2500, email: "huerfano@b.com" }])
    );
    const mock = useSupabaseMock({
      selectLimitResult: { data: [{ id: 1 }], error: null },
      selectEqResultByValue: { chr_huerfano: { data: null, error: null } },
    });

    await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    expect(alertaTelegram).toHaveBeenCalled();
    const mensaje = mensajesDeAlerta().find((m) => m.includes("chr_huerfano"));
    expect(mensaje).toBeDefined();
    expect(mensaje).toContain("25"); // S/25.00, ver toFixed(2) en el handler
    expect(mock.calls.insertArgs.length).toBe(0);
  });

  it("caso 9: la llamada a Culqi falla -> alerta, y el keep-warm sigue contando exitoso", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_cron");
    mockListadoCulqi("reject");
    useSupabaseMock({ selectLimitResult: { data: [{ id: 1 }], error: null } });

    const res = await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    expect(res.status).toBe(200); // keep-warm paso, Culqi caido no lo tumba
    expect(alertaTelegram).toHaveBeenCalled();
  });

  it("caso 10: Culqi devuelve el mismo cargo huerfano dos veces -> una sola alerta por cargo en la pasada", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_cron");
    mockListadoCulqi(
      listadoOk([
        { id: "chr_dup", amount: 1500, email: "dup@b.com" },
        { id: "chr_dup", amount: 1500, email: "dup@b.com" },
      ])
    );
    useSupabaseMock({
      selectLimitResult: { data: [{ id: 1 }], error: null },
      selectEqResultByValue: { chr_dup: { data: null, error: null } },
    });

    await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    const alertasDelCargo = mensajesDeAlerta().filter((m) => m.includes("chr_dup"));
    expect(alertasDelCargo.length).toBe(1);
  });

  it("sin CULQI_SECRET_KEY -> alerta especifica de configuracion, sin tumbar el keep-warm", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-largo-de-verdad");
    vi.stubEnv("CULQI_SECRET_KEY", "");
    useSupabaseMock({ selectLimitResult: { data: [{ id: 1 }], error: null } });

    const res = await GET(req({ authorization: "Bearer secreto-largo-de-verdad" }));

    expect(res.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    expect(alertaTelegram).toHaveBeenCalled();
    expect(mensajesDeAlerta().some((m) => m.includes("CULQI_SECRET_KEY"))).toBe(true);
  });
});
