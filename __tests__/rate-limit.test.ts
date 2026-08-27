// RED (D-23): este archivo se escribe ANTES de que exista lib/rate-limit.ts.
// La corrida debe fallar por resolucion de modulo, no por un assert.
//
// D-26: calcularWindowStart() y debeBloquear() son puras y se prueban sin
// red. contarIntento() es la unica parte impura (llama al RPC de Postgres);
// aca solo se prueba que REACCIONA bien al numero/error que el RPC devuelve,
// nunca que el incremento es atomico -- eso lo garantiza Postgres y se
// verifica a mano (Task 5 del plan 01-06), no con un mock.

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
import {
  calcularWindowStart,
  contarIntento,
  debeBloquear,
  LIMITE_INTENTOS,
  VENTANA_MS,
} from "@/lib/rate-limit";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("calcularWindowStart", () => {
  it("dos timestamps dentro de la misma ventana devuelven el mismo string", () => {
    const windowMs = 60 * 60 * 1000; // 1 hora
    const base = new Date("2026-08-26T10:00:00.000Z").getTime();
    const a = calcularWindowStart(base, windowMs);
    const b = calcularWindowStart(base + 30 * 60 * 1000, windowMs); // +30min, misma ventana
    expect(a).toBe(b);
  });

  it("un timestamp justo en el borde superior cae en la ventana siguiente", () => {
    const windowMs = 60 * 60 * 1000;
    const inicioVentana = new Date("2026-08-26T10:00:00.000Z").getTime();
    const finVentana = inicioVentana + windowMs; // borde exacto, ya es la ventana siguiente
    const a = calcularWindowStart(inicioVentana, windowMs);
    const b = calcularWindowStart(finVentana, windowMs);
    expect(a).not.toBe(b);
  });

  it("el resultado es siempre ISO valido y multiplo exacto de windowMs desde epoch", () => {
    const windowMs = 60 * 60 * 1000;
    const now = new Date("2026-08-26T10:37:12.345Z").getTime();
    const resultado = calcularWindowStart(now, windowMs);
    expect(() => new Date(resultado).toISOString()).not.toThrow();
    expect(new Date(resultado).getTime() % windowMs).toBe(0);
  });
});

describe("debeBloquear", () => {
  it("por debajo del limite no bloquea", () => {
    expect(debeBloquear(5, 10)).toBe(false);
  });

  it("en el limite exacto NO bloquea -- el limite es la cantidad de intentos permitidos", () => {
    expect(debeBloquear(10, 10)).toBe(false);
  });

  it("por encima del limite bloquea", () => {
    expect(debeBloquear(11, 10)).toBe(true);
  });
});

describe("contarIntento", () => {
  beforeEach(() => {
    vi.mocked(alertaTelegram).mockClear();
  });

  it("devuelve el numero que el RPC devolvio", async () => {
    const mock = createSupabaseMock({ rpcResults: [{ data: 3, error: null }] });
    vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);

    const resultado = await contarIntento("190.1.2.3", VENTANA_MS);

    expect(resultado).toBe(3);
    expect(mock.calls.rpcArgs[0].fn).toBe("increment_rate_limit");
    expect(mock.calls.rpcArgs[0].params).toMatchObject({ p_ip: "190.1.2.3" });
  });

  it("fail-open: ante un error de Supabase, deja pasar el request (devuelve 0) y alerta", async () => {
    const mock = createSupabaseMock({
      rpcResults: [{ data: null, error: { message: "conexion rechazada" } }],
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue(mock.client as never);

    const resultado = await contarIntento("190.1.2.3", VENTANA_MS);

    expect(resultado).toBe(0);
    expect(debeBloquear(resultado, LIMITE_INTENTOS)).toBe(false);
    expect(alertaTelegram).toHaveBeenCalledTimes(1);
    expect(vi.mocked(alertaTelegram).mock.calls[0][0]).toContain("rate limit");
  });

  it("fail-open: ante una excepcion del RPC, tambien deja pasar (devuelve 0) y alerta", async () => {
    const client = {
      rpc: vi.fn().mockRejectedValue(new Error("timeout")),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(client as never);

    const resultado = await contarIntento("190.1.2.3", VENTANA_MS);

    expect(resultado).toBe(0);
    expect(alertaTelegram).toHaveBeenCalledTimes(1);
  });
});
