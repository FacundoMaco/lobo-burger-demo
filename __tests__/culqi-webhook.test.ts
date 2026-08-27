// @vitest-environment node
// Handler definitivo del webhook de Culqi (PAY-02, PAY-03, PAY-04). Reemplaza
// el endpoint temporal de captura del plan 01-02. RED primero, contra la
// ruta que hoy solo loguea el payload.
//
// D-08: el payload es un puntero -- extraerChargeId() + consultarCargo() (de
// lib/culqi-verificar.ts, plan 01-07 Task 1) hacen el trabajo real de
// verificacion. Estos tests mockean fetch (no lib/culqi-verificar), asi el
// puntero-y-re-fetch corre de verdad contra un fetch controlado, igual que
// __tests__/api-charge.rate-limit.test.ts hace con Culqi.
//
// Opcion C (checkpoint Task 2): el detalle del pedido viaja en cargo.metadata
// (escrito por /api/charge). Si falta, esta vacia o no parsea, el handler
// degrada a una fila incompleta en vez de fallar -- nunca peor que la opcion A.

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
import { POST } from "@/app/api/culqi/webhook/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/culqi/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function metadataPedido(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    items: [{ id: 1, qty: 2 }],
    nombre: "Juan Perez",
    telefono: "999999999",
    delivery: false,
    direccion: null,
    ...overrides,
  });
}

function mockCulqiGetCargo(respuesta: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (String(url).startsWith("https://api.culqi.com/v2/charges/")) {
      return respuesta as Response;
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

function cargoOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      id: "chr_test_1",
      amount: 3600,
      email: "cliente@example.com",
      outcome: { type: "venta_exitosa" },
      metadata: { pedido: metadataPedido() },
      ...overrides,
    }),
  };
}

function useSupabaseMock(
  insertResult: { data: { codigo: string } | null; error: { code?: string; message?: string } | null }
) {
  const mock = createSupabaseMock({ insertResult });
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
  return mock;
}

beforeEach(() => {
  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(alertaTelegram).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/culqi/webhook -- payload sin id reconocible", () => {
  it("responde 400 y NUNCA llama a fetch (consultarCargo no se invoca)", async () => {
    const res = await POST(req({ foo: "bar" }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/culqi/webhook -- Culqi no confirma el cargo (D-08, T-01-33)", () => {
  it("id inventado, Culqi responde 404 -> no escribe nada en pedidos", async () => {
    mockCulqiGetCargo({ ok: false, status: 404 });
    const mock = useSupabaseMock({ data: null, error: null });
    await POST(req({ id: "chr_inventado" }));
    expect(mock.calls.insertArgs.length).toBe(0);
  });
});

describe("POST /api/culqi/webhook -- camino feliz (metadata completa, opcion C)", () => {
  it("cargo confirmado, no existe fila -> crea fila completa desde la metadata y responde 200", async () => {
    mockCulqiGetCargo(cargoOk());
    const mock = useSupabaseMock({ data: { codigo: "LB-WEBHOOK1" }, error: null });

    const res = await POST(req({ id: "chr_test_1" }));

    expect(res.status).toBe(200);
    expect(mock.calls.insertArgs.length).toBe(1);
    expect(mock.calls.insertArgs[0]).toMatchObject({
      culqi_charge_id: "chr_test_1",
      cliente_nombre: "Juan Perez",
      cliente_telefono: "999999999",
      cliente_email: "cliente@example.com",
      delivery: false,
      direccion: null,
      items: [{ id: 1, qty: 2 }],
    });
    expect(alertaTelegram).not.toHaveBeenCalled();
  });

  it("consultarCargo (fetch) se llama exactamente una vez, y solo entonces se escribe en pedidos", async () => {
    mockCulqiGetCargo(cargoOk());
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });
    await POST(req({ id: "chr_test_1" }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mock.calls.insertArgs.length).toBe(1);
  });

  it("el monto que se escribe es el que devuelve consultarCargo, no el del body (T-01-34)", async () => {
    mockCulqiGetCargo(cargoOk({ amount: 3600 }));
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });

    await POST(req({ id: "chr_test_1", amount: 100 })); // amount mentiroso en el body

    expect(mock.calls.insertArgs[0]?.total_centimos).toBe(3600);
  });

  it("delivery:true con direccion -> la persiste desde la metadata", async () => {
    mockCulqiGetCargo(
      cargoOk({
        metadata: { pedido: metadataPedido({ delivery: true, direccion: "Av. Siempre Viva 742" }) },
      })
    );
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });

    await POST(req({ id: "chr_test_1" }));

    expect(mock.calls.insertArgs[0]).toMatchObject({
      delivery: true,
      direccion: "Av. Siempre Viva 742",
    });
  });
});

describe("POST /api/culqi/webhook -- doble entrega y carrera con /api/charge (T-01-35)", () => {
  it("doble entrega del mismo evento: 23505 -> responde 200, no crea una segunda fila", async () => {
    mockCulqiGetCargo(cargoOk());
    const mock = useSupabaseMock({ data: null, error: { code: "23505" } });

    const res = await POST(req({ id: "chr_test_1" }));

    expect(res.status).toBe(200);
    expect(mock.calls.insertArgs.length).toBe(1); // se intento una vez, no reintenta
  });

  it("carrera con /api/charge (la fila ya existe cuando llega el webhook): 200, sin update (T-01-36, D-09)", async () => {
    mockCulqiGetCargo(cargoOk());
    const mock = useSupabaseMock({ data: null, error: { code: "23505" } });

    const res = await POST(req({ id: "chr_test_1" }));

    expect(res.status).toBe(200);
    // El mock de supabase no implementa .update(): si el handler alguna vez
    // llamara a algo distinto de from/insert/select/rpc, esta linea rompe
    // con un TypeError antes de llegar aca -- la ausencia de excepcion ya
    // prueba que el handler no intento actualizar nada.
    expect(mock.calls.table).toEqual(["pedidos"]);
  });
});

describe("POST /api/culqi/webhook -- Supabase caido (T-01-38)", () => {
  it("error distinto de 23505 -> responde NO-2xx y alerta por Telegram", async () => {
    mockCulqiGetCargo(cargoOk());
    useSupabaseMock({ data: null, error: { code: "OTRO_ERROR", message: "timeout" } });

    const res = await POST(req({ id: "chr_test_1" }));

    const esNo2xx = res.status < 200 || res.status >= 300;
    expect(esNo2xx).toBe(true);
  });

  it("dispara alertaTelegram con el id del cargo", async () => {
    mockCulqiGetCargo(cargoOk());
    useSupabaseMock({ data: null, error: { code: "OTRO_ERROR", message: "timeout" } });

    await POST(req({ id: "chr_test_1" }));

    expect(alertaTelegram).toHaveBeenCalled();
    expect(vi.mocked(alertaTelegram).mock.calls[0][0]).toContain("chr_test_1");
  });
});

describe("POST /api/culqi/webhook -- degradacion sin metadata (opcion C, nunca peor que A)", () => {
  it("metadata ausente -> crea fila incompleta con placeholders y alerta, responde 200", async () => {
    mockCulqiGetCargo(cargoOk({ metadata: null }));
    const mock = useSupabaseMock({ data: { codigo: "LB-INCOMPLETO" }, error: null });

    const res = await POST(req({ id: "chr_test_1" }));

    expect(res.status).toBe(200);
    expect(mock.calls.insertArgs.length).toBe(1);
    expect(mock.calls.insertArgs[0]?.cliente_email).toBe("cliente@example.com");
    expect(mock.calls.insertArgs[0]?.total_centimos).toBe(3600);
    expect(alertaTelegram).toHaveBeenCalled();
    expect(vi.mocked(alertaTelegram).mock.calls[0][0]).toContain("chr_test_1");
  });

  it("metadata.pedido no es JSON parseable -> degrada igual, no lanza", async () => {
    mockCulqiGetCargo(cargoOk({ metadata: { pedido: "{esto no es json" } }));
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });

    const res = await POST(req({ id: "chr_test_1" }));

    expect(res.status).toBe(200);
    expect(mock.calls.insertArgs.length).toBe(1);
    expect(alertaTelegram).toHaveBeenCalled();
  });

  it("metadata sin items (vacio) -> degrada, no crea una fila con items invalidos", async () => {
    mockCulqiGetCargo(cargoOk({ metadata: { pedido: metadataPedido({ items: [] }) } }));
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });

    await POST(req({ id: "chr_test_1" }));

    expect(mock.calls.insertArgs[0]?.items).toEqual([]);
    expect(alertaTelegram).toHaveBeenCalled();
  });
});

describe("POST /api/culqi/webhook -- D-10 (nada de logica de reintentos)", () => {
  it("no importa cuantas veces se invoque con el mismo id -- cada llamada es independiente", async () => {
    mockCulqiGetCargo(cargoOk());
    useSupabaseMock({ data: { codigo: "LB-X" }, error: null });

    const res1 = await POST(req({ id: "chr_test_1" }));
    const res2 = await POST(req({ id: "chr_test_1" }));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
