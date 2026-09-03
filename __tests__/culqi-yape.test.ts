// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createYapeToken } from "@/lib/culqi-yape";

describe("lib/culqi-yape", () => {
  const originalEnv = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY = "pk_test_123456";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY = originalEnv;
  });

  it("rechaza teléfonos que no tengan exactamente 9 dígitos", async () => {
    const res = await createYapeToken({
      phone: "12345",
      otp: "123456",
      amountCents: 2000,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("9 dígitos");
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rechaza códigos OTP que no tengan 6 dígitos", async () => {
    const res = await createYapeToken({
      phone: "987654321",
      otp: "123",
      amountCents: 2000,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("6 dígitos");
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("llama a la API de Culqi con el payload requerido y retorna tokenId al tener éxito", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "ype_test_abcdef123456", object: "token" }),
    } as Response);

    const res = await createYapeToken({
      phone: "987 654 321",
      otp: "654 321",
      amountCents: 4500,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.tokenId).toBe("ype_test_abcdef123456");
    }

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.culqi.com/v2/tokens/yape",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer pk_test_123456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number_phone: "987654321",
          otp: "654321",
          amount: 4500,
        }),
      })
    );
  });

  it("retorna el user_message devuelto por Culqi cuando el OTP es inválido o expirado", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        object: "error",
        user_message: "El código de aprobación es incorrecto",
      }),
    } as Response);

    const res = await createYapeToken({
      phone: "987654321",
      otp: "000000",
      amountCents: 4500,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("El código de aprobación es incorrecto");
    }
  });

  it("maneja errores de red gracefully", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network offline"));

    const res = await createYapeToken({
      phone: "987654321",
      otp: "123456",
      amountCents: 4500,
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Error de conexión");
    }
  });
});
