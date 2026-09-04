import { describe, it, expect, vi } from "vitest";
import { persistOrderTransition } from "@/lib/order-transition";

describe("persistOrderTransition", () => {
  it("devuelve { ok: true } cuando el fetch resuelve ok:true", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await persistOrderTransition({
      codigo: "LB-1",
      estado: "en_preparacion",
      fetchImpl,
    });

    expect(result).toEqual({ ok: true });
  });

  it("devuelve { ok: false, reason: 'http_500' } cuando el fetch resuelve ok:false", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await persistOrderTransition({
      codigo: "LB-1",
      estado: "en_preparacion",
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, reason: "http_500" });
  });

  it("devuelve { ok: false, reason: 'network' } cuando el fetch rechaza, sin lanzar", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await persistOrderTransition({
      codigo: "LB-1",
      estado: "en_preparacion",
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, reason: "network" });
  });

  it("envia method PATCH, Content-Type json y el body exacto a /api/admin/pedidos", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await persistOrderTransition({
      codigo: "LB-1",
      estado: "en_preparacion",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/admin/pedidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: "LB-1", estado: "en_preparacion" }),
    });
  });
});
