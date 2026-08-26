// @vitest-environment node
// alertaTelegram es el canal humano de alertas -- ver lib/alertas.ts. Estos
// tests cubren las tres ramas: sin configuracion, configurada, y de fallo.
// Ningun test golpea api.telegram.org de verdad (D-26): que el mensaje
// llegue a un celular se verifica a mano en el plan 01-08.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { alertaTelegram } from "@/lib/alertas";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("alertaTelegram -- sin configuracion (D-03b)", () => {
  it("sin TELEGRAM_ALERT_BOT_TOKEN: no llama a fetch, hace console.error con el mensaje, y resuelve sin lanzar", async () => {
    vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "chat_123");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(alertaTelegram("pedido cobrado sin registrar")).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("pedido cobrado sin registrar")
    );
  });

  it("sin TELEGRAM_ALERT_CHAT_ID: no llama a fetch, hace console.error con el mensaje, y resuelve sin lanzar", async () => {
    vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "tok_123");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(alertaTelegram("pedido cobrado sin registrar")).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("pedido cobrado sin registrar")
    );
  });

  it("con ambas presentes pero vacias (''): mismo comportamiento que sin configurar", async () => {
    vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(alertaTelegram("pedido cobrado sin registrar")).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("alertaTelegram -- configurada", () => {
  it("hace exactamente un fetch POST a la Bot API con chat_id y text, y el token no aparece en el body", async () => {
    vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "tok_secreto_999");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "chat_456");
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    await alertaTelegram("pedido LB-XYZ cobrado sin registrar");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottok_secreto_999/sendMessage");
    expect(options?.method).toBe("POST");
    expect((options?.headers as Record<string, string>)?.["Content-Type"]).toBe(
      "application/json"
    );

    const body = JSON.parse(String(options?.body));
    expect(body).toEqual({
      chat_id: "chat_456",
      text: "pedido LB-XYZ cobrado sin registrar",
    });
    expect(String(options?.body)).not.toContain("tok_secreto_999");
  });
});

describe("alertaTelegram -- rama de fallo (best-effort de verdad)", () => {
  it("si fetch rechaza (red caida): no lanza, resuelve, y hace console.error", async () => {
    vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "tok_123");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "chat_456");
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(alertaTelegram("algo se rompio")).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it("si fetch resuelve con ok:false (token revocado, chat_id equivocado, 429): no lanza, resuelve, y hace console.error incluyendo el status", async () => {
    vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "tok_123");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "chat_456");
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(alertaTelegram("algo se rompio")).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("401"));
  });
});
