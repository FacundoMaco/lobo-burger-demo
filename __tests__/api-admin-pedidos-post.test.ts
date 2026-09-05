// @vitest-environment node
// Bug real (reportado en produccion, KDS): "Simular Pedido Web" quedaba
// atascado en "pendiente" sin importar cuantas veces se apretara "A LA
// PLANCHA". Causa: pedidos.culqi_charge_id es NOT NULL UNIQUE (ver
// supabase/migrations/20260820000000_pedidos.sql) y el POST nunca lo mandaba
// -> el insert violaba el constraint, caia al catch silencioso, y el pedido
// vivia solo en simulatedOrdersStore con estado congelado: el PATCH de
// "A LA PLANCHA" actualizaba Supabase pero no encontraba ninguna fila.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabase-mock";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from "@/lib/supabase";
import { POST } from "@/app/api/admin/pedidos/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/admin/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let supabaseMock: ReturnType<typeof createSupabaseMock>;

beforeEach(() => {
  supabaseMock = createSupabaseMock({
    insertResult: { data: { codigo: "LB-SIM-TEST" }, error: null },
  });
  vi.mocked(getSupabaseAdmin).mockReturnValue(supabaseMock.client as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/pedidos -- pedido simulado", () => {
  it("el insert incluye culqi_charge_id no nulo (constraint NOT NULL UNIQUE de la tabla)", async () => {
    await POST(req({}));
    const insertado = supabaseMock.calls.insertArgs[0][0] as Record<string, unknown>;
    expect(insertado.culqi_charge_id).toBeTruthy();
    expect(typeof insertado.culqi_charge_id).toBe("string");
  });

  it("culqi_charge_id es distinto para dos pedidos simulados (no viola UNIQUE)", async () => {
    await POST(req({ codigo: "LB-SIM-UNO" }));
    await POST(req({ codigo: "LB-SIM-DOS" }));
    const [primero, segundo] = supabaseMock.calls.insertArgs.map(a => a[0] as Record<string, unknown>);
    expect(primero.culqi_charge_id).not.toBe(segundo.culqi_charge_id);
  });

  it("culqi_charge_id se deriva del codigo cuando el body lo manda explicito", async () => {
    await POST(req({ codigo: "LB-SIM-FIJO" }));
    const insertado = supabaseMock.calls.insertArgs[0][0] as Record<string, unknown>;
    expect(insertado.codigo).toBe("LB-SIM-FIJO");
    expect(insertado.culqi_charge_id).toContain("LB-SIM-FIJO");
  });
});
