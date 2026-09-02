// @vitest-environment node
// El entorno por defecto de vitest.config.mts es jsdom. Un route handler de
// Next se prueba contra los Request/Response nativos de Node 20, no del DOM
// -- por eso este archivo fuerza "node". No borrar esta linea.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabase-mock";

// GATE INVERTIDO (D-25): esta caracterizacion se escribe contra el
// comportamiento ACTUAL de app/api/charge/route.ts. Debe pasar en verde al
// primer intento, sin tocar produccion. Un rojo aca es un bug preexistente,
// no algo que se arregla de paso -- ver 01-HALLAZGOS-CARACTERIZACION.md.

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
    items: [{ id: 1001, qty: 1 }], // Miami Night, S/18
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

function mockCulqiRechazado(userMessage = "Tarjeta rechazada") {
  vi.mocked(fetch).mockResolvedValue({
    ok: false,
    json: async () => ({ user_message: userMessage }),
  } as Response);
}

function useSupabaseMock(
  insertResult: { data: { codigo: string } | null; error: { code?: string } | null },
  selectEqResult?: { data: { codigo: string } | null; error: { code?: string } | null }
) {
  const mock = createSupabaseMock({ insertResult, selectEqResult });
  // mockClear (no mockReset/mockRestore): el mock viene de un vi.mock()
  // factory de nivel de modulo, restoreAllMocks() en afterEach no le limpia
  // el historial de llamadas entre tests (solo aplica de lleno a vi.spyOn).
  // Sin este clear, "toHaveBeenCalled()"/".not.toHaveBeenCalled()" arrastran
  // llamadas de tests anteriores dentro del mismo archivo.
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);
  return mock;
}

beforeEach(() => {
  vi.stubEnv("CULQI_SECRET_KEY", "sk_test_x");
  vi.stubGlobal("fetch", vi.fn());
  // Default: insert exitoso. Los tests de las ramas de conflicto/fallo lo
  // sobreescriben explicitamente.
  useSupabaseMock({ data: { codigo: "LB-DEFAULT" }, error: null });
  vi.mocked(getMenuItemLive).mockImplementation(async (id: number) => CATALOGO_TEST.find((i) => i.id === id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/charge -- configuracion faltante", () => {
  it("responde 500 si falta CULQI_SECRET_KEY", async () => {
    vi.stubEnv("CULQI_SECRET_KEY", "");
    const res = await POST(req(bodyValido()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Pasarela no configurada" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/charge -- body invalido, antes de tocar Culqi", () => {
  it("responde 400 si el body no es JSON parseable", async () => {
    const res = await POST(req("{esto no es json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Solicitud inválida" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["tokenId", bodyValido({ tokenId: undefined })],
    ["email", bodyValido({ email: undefined })],
    ["name", bodyValido({ name: undefined })],
    ["phone", bodyValido({ phone: undefined })],
    ["items no es array", bodyValido({ items: "no-array" })],
    ["items vacio", bodyValido({ items: [] })],
  ])("responde 400 si falta o es invalido: %s", async (_desc, body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Datos del pedido inválidos" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si una linea tiene qty no entero (1.5)", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: 1, qty: 1.5 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Datos del pedido inválidos" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si una linea tiene id no entero", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: 1.5, qty: 1 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Datos del pedido inválidos" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/charge -- recalculo del precio (el corazon de INFRA-04)", () => {
  it("recalcula el total contra lib/menu.ts: 2 Miami Night + 1 Gaseosa = 3980 centimos", async () => {
    mockCulqiCargoOk();
    const res = await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 2 }, // Miami Night S/18 x2 = 3600
            { id: 1015, qty: 1 }, // Gaseosa S/5 = 500
          ],
        })
      )
    );
    expect(res.status).toBe(200);
    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    expect(culqiBody.amount).toBe(3980);
  });

  it("ANTIREGRESION -- ignora un amount/total enviado por el cliente y sigue cobrando 3980", async () => {
    // Este es el test que debe romperse si alguien vuelve a confiar en el
    // precio que manda el navegador (el exploit de pagar S/3 un pedido de
    // S/38, arreglado el 2026-08-20). Si este test pasa con el codigo
    // actual, significa que el servidor sigue ignorando estos campos.
    mockCulqiCargoOk();
    const res = await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 2 },
            { id: 1015, qty: 1 },
          ],
          amount: 300, // 3 soles -- intento de manipular el monto
          total: 3,
        })
      )
    );
    expect(res.status).toBe(200);
    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    expect(culqiBody.amount).toBe(3980);
  });

  it("envia currency_code PEN y source_id igual al tokenId recibido", async () => {
    mockCulqiCargoOk();
    await POST(req(bodyValido({ tokenId: "tkn_abc_999" })));
    const [, fetchOptions] = vi.mocked(fetch).mock.calls[0];
    const culqiBody = JSON.parse(String(fetchOptions?.body));
    expect(culqiBody.currency_code).toBe("PEN");
    expect(culqiBody.source_id).toBe("tkn_abc_999");
  });
});

describe("POST /api/charge -- bounds", () => {
  it("responde 400 'Cantidad no permitida' si qty=21 (MAX_QTY=20), sin llamar a Culqi", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: 1, qty: 21 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cantidad no permitida" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 'Cantidad no permitida' si qty=0", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: 1, qty: 0 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cantidad no permitida" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 400 si el total supera MAX_CENTS (Combo Bestia x20 = 76000 centimos), sin llamar a Culqi", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: 1030, qty: 20 }, { id: 1029, qty: 20 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El monto del pedido no es válido" });
    expect(fetch).not.toHaveBeenCalled();
  });

  // MIN_CENTS (300) es HOY inalcanzable con la carta vigente: el item mas
  // barato es la Gaseosa a 500 centimos (S/5). No se escribe un test que
  // finja cubrir esta rama -- ver 01-HALLAZGOS-CARACTERIZACION.md.

  it("responde 400 si el id del producto no existe (999)", async () => {
    const res = await POST(req(bodyValido({ items: [{ id: 9999, qty: 1 }] })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Hay un producto que ya no está disponible" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("POST /api/charge -- delivery", () => {
  it("responde 400 si delivery=true y address esta vacio o solo espacios", async () => {
    const res = await POST(req(bodyValido({ delivery: true, address: "   " })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Falta la dirección de entrega" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("guarda la direccion trimmeada cuando delivery=true", async () => {
    mockCulqiCargoOk();
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });
    await POST(req(bodyValido({ delivery: true, address: "  Av. Siempre Viva 742  " })));
    expect(mock.calls.insertArgs[0]?.direccion).toBe("Av. Siempre Viva 742");
  });

  it("guarda direccion: null cuando delivery=false", async () => {
    mockCulqiCargoOk();
    const mock = useSupabaseMock({ data: { codigo: "LB-X" }, error: null });
    await POST(req(bodyValido({ delivery: false })));
    expect(mock.calls.insertArgs[0]?.direccion).toBeNull();
  });
});

describe("POST /api/charge -- cargo rechazado por Culqi", () => {
  // NOTA (01-06, PAY-06): esta asercion originalmente esperaba que
  // getSupabaseAdmin() no se llamara NUNCA en esta rama. Eso dejo de ser
  // cierto de forma legitima con el rate limiter (PAY-06): el contador de
  // intentos vive en Supabase y se consulta ANTES que todo lo demas,
  // incluido el fetch a Culqi -- si se aplicara despues del cobro rechazado
  // no serviria contra card testing. Lo que esta asercion protegia de
  // verdad es que un cargo rechazado NUNCA persiste una fila en "pedidos";
  // eso sigue siendo cierto y es lo que se verifica ahora.
  it("responde 402 con el mensaje de Culqi y no persiste el pedido en Supabase", async () => {
    mockCulqiRechazado("Tarjeta rechazada");
    const mock = useSupabaseMock({ data: { codigo: "LB-DEFAULT" }, error: null });
  vi.mocked(getMenuItemLive).mockImplementation(async (id: number) => CATALOGO_TEST.find((i) => i.id === id));
    const res = await POST(req(bodyValido()));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "Tarjeta rechazada" });
    expect(mock.calls.table).not.toContain("pedidos");
    expect(mock.calls.insertArgs.length).toBe(0);
  });
});

describe("POST /api/charge -- persistencia", () => {
  it("camino feliz: 200 con chargeId, codigo del insert y total en SOLES", async () => {
    mockCulqiCargoOk({ id: "chr_feliz_1" });
    useSupabaseMock({ data: { codigo: "LB-X" }, error: null });
    const res = await POST(
      req(
        bodyValido({
          items: [
            { id: 1001, qty: 2 },
            { id: 1015, qty: 1 },
          ],
        })
      )
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ chargeId: "chr_feliz_1", codigo: "LB-X", total: 39.8 });
  });

  it("idempotencia 23505: devuelve el codigo del pedido ya existente consultando por culqi_charge_id", async () => {
    mockCulqiCargoOk({ id: "chr_dup_1" });
    const mock = useSupabaseMock(
      { data: null, error: { code: "23505" } },
      { data: { codigo: "LB-PREVIO" }, error: null }
    );
    const res = await POST(req(bodyValido()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ chargeId: "chr_dup_1", codigo: "LB-PREVIO", total: 17.9 });
    expect(mock.calls.selectEqArgs[0]).toEqual({ column: "culqi_charge_id", value: "chr_dup_1" });
  });

  it("fallo de insert (no 23505) tras cargo exitoso: 200 igual + console.error con el cargo.id", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCulqiCargoOk({ id: "chr_fallo_insert_1" });
    useSupabaseMock({ data: null, error: { code: "OTRO_ERROR" } });
    const res = await POST(req(bodyValido()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chargeId).toBe("chr_fallo_insert_1");
    expect(errorSpy).toHaveBeenCalledWith(
      "Pedido cobrado pero no registrado:",
      "chr_fallo_insert_1",
      expect.anything()
    );
  });

  it("excepcion de getSupabaseAdmin() tras cargo exitoso: 200 con codigo generado + console.error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCulqiCargoOk({ id: "chr_excepcion_1" });
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    });
    const res = await POST(req(bodyValido()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.chargeId).toBe("chr_excepcion_1");
    expect(typeof json.codigo).toBe("string");
    expect(errorSpy).toHaveBeenCalledWith(
      "Pedido cobrado pero no registrado:",
      "chr_excepcion_1",
      expect.anything()
    );
  });
});
