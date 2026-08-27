// @vitest-environment node
// lib/culqi-verificar.ts es el corazon de D-08: el payload del webhook es un
// puntero, no un hecho. extraerChargeId() es pura (sin red); consultarCargo()
// hace el GET autenticado contra Culqi. Se testean por separado (D-26).
//
// SUPUESTO PAY-01 (NO VERIFICADO, ver 01-07-SUMMARY.md): 01-CULQI-FLUJO.md no
// se pudo producir -- el plan 01-02 quedo bloqueado antes del pago real. Estos
// tests cubren el parseo defensivo de RESEARCH.md sin asumir una forma unica.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consultarCargo, extraerChargeId } from "@/lib/culqi-verificar";

describe("extraerChargeId -- pura, sin red", () => {
  it("body.id string -> devuelve el id", () => {
    expect(extraerChargeId({ id: "chr_test_123" })).toBe("chr_test_123");
  });

  it("body.data.id string -> devuelve el id anidado", () => {
    expect(extraerChargeId({ data: { id: "chr_test_456" } })).toBe("chr_test_456");
  });

  it("body.object.id string -> devuelve el id anidado", () => {
    expect(extraerChargeId({ object: { id: "ord_test_789" } })).toBe("ord_test_789");
  });

  it("objeto vacio -> null", () => {
    expect(extraerChargeId({})).toBeNull();
  });

  it("null -> null", () => {
    expect(extraerChargeId(null)).toBeNull();
  });

  it("undefined -> null", () => {
    expect(extraerChargeId(undefined)).toBeNull();
  });

  it("string suelto -> null (no es un objeto)", () => {
    expect(extraerChargeId("chr_123")).toBeNull();
  });

  it("array -> null", () => {
    expect(extraerChargeId([])).toBeNull();
  });

  it("id numerico (no string) -> null, falla cerrado en vez de adivinar", () => {
    expect(extraerChargeId({ id: 123 })).toBeNull();
  });

  it("data no es un objeto -> null, no revienta", () => {
    expect(extraerChargeId({ data: "chr_123" })).toBeNull();
  });
});

describe("consultarCargo -- impura, fetch mockeado", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("CULQI_SECRET_KEY", "sk_test_secreto_999");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("200 -> devuelve el objeto parseado", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "chr_test_1", amount: 1800, outcome: { type: "venta_exitosa" }, email: "cliente@example.com" }),
    } as Response);

    const cargo = await consultarCargo("chr_test_1");

    expect(cargo).toEqual({
      id: "chr_test_1",
      amount: 1800,
      state: "venta_exitosa",
      email: "cliente@example.com",
      metadata: null,
    });
  });

  it("200 con metadata -> la pasa tal cual, sin interpretarla (eso lo hace el webhook, D-09)", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chr_test_2",
        amount: 1800,
        email: "cliente@example.com",
        metadata: { pedido: '{"items":[{"id":1,"qty":1}]}' },
      }),
    } as Response);

    const cargo = await consultarCargo("chr_test_2");

    expect(cargo?.metadata).toEqual({ pedido: '{"items":[{"id":1,"qty":1}]}' });
  });

  it("404 -> null (id inventado, no existe en Culqi)", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);

    expect(await consultarCargo("chr_no_existe")).toBeNull();
  });

  it("envia Authorization: Bearer <CULQI_SECRET_KEY>", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "chr_test_1", amount: 1800, email: "a@b.com" }),
    } as Response);

    await consultarCargo("chr_test_1");

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options?.headers as Record<string, string>)?.Authorization).toBe(
      "Bearer sk_test_secreto_999"
    );
  });

  it("la secret key nunca aparece en la URL, solo en el header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "chr_test_1", amount: 1800, email: "a@b.com" }),
    } as Response);

    await consultarCargo("chr_test_1");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("sk_test_secreto_999");
    expect(String(url)).toBe("https://api.culqi.com/v2/charges/chr_test_1");
  });

  it("sin CULQI_SECRET_KEY configurada -> null, falla cerrado, no llama a fetch", async () => {
    vi.stubEnv("CULQI_SECRET_KEY", "");

    expect(await consultarCargo("chr_test_1")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
