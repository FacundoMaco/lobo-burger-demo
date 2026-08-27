// @vitest-environment node
// Cron diario (D-16): keep-warm real (INFRA-01) + reconciliacion de cargos
// huerfanos en Culqi (INFRA-02, D-12), en una sola pasada -- Vercel Hobby
// permite una unica ejecucion diaria. Ver 01-08-PLAN.md.
//
// Task 1 (casos 1 a 5): el gate de autorizacion con CRON_SECRET y el
// keep-warm real contra "pedidos". La reconciliacion todavia no existe --
// es la Task 2.

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

beforeEach(() => {
  vi.mocked(alertaTelegram).mockClear();
  vi.mocked(getSupabaseAdmin).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
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
