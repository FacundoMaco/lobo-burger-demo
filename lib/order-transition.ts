// Helper puro de persistencia de cambio de estado. Sin "use client", sin DOM,
// sin React (mismo contrato que lib/auto-print.ts) para poder testearlo con
// un fetch inyectado.
//
// Por que existe: fetch no rechaza ante un HTTP 500, asi que un .catch()
// suelto sobre el PATCH deja pasar el fallo real de Supabase como si fuera
// un exito silencioso.

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export interface PersistOrderTransitionOptions {
  codigo: string;
  estado: string;
  fetchImpl?: typeof fetch;
}

export async function persistOrderTransition({
  codigo,
  estado,
  fetchImpl,
}: PersistOrderTransitionOptions): Promise<TransitionResult> {
  const doFetch = fetchImpl ?? fetch;

  try {
    const res = await doFetch("/api/admin/pedidos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, estado }),
    });

    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}
