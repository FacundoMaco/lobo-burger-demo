// Cron diario (D-16): keep-warm real (INFRA-01) + reconciliacion de cargos
// huerfanos en Culqi (INFRA-02, D-12), en una sola pasada -- Vercel Hobby
// permite una unica ejecucion diaria (RESEARCH.md Pattern 3).
//
// Keep-warm: Supabase mide inactividad por queries que llegan al proyecto,
// no por un 200 de una ruta que no la toca (PITFALLS.md pitfall 13, D-14).
// Por eso este handler hace una query real contra "pedidos" antes que nada,
// nunca un 200 vacio.
//
// Gate: Vercel manda automaticamente CRON_SECRET como header Authorization
// (RESEARCH.md Pattern 3, verificado contra vercel.com/docs). Sin el
// secreto configurado en el entorno, la ruta falla cerrada -- mismo patron
// que proxy.ts con ADMIN_USER/ADMIN_PASSWORD. Esta ruta queda fuera del
// matcher de proxy.ts (Vercel no puede autenticarse con Basic Auth), asi
// que este gate es la unica proteccion.

import { getSupabaseAdmin } from "@/lib/supabase";
import { alertaTelegram } from "@/lib/alertas";

function autorizado(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

// Devuelve true si la base respondio. Distingue el problema de configuracion
// (faltan las credenciales de Supabase, lib/supabase.ts) del problema de que
// la base este pausada/caida -- son dos fallas distintas y el mensaje de
// alerta dice cual es (T-01-45).
async function keepWarm(): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdmin().from("pedidos").select("id").limit(1);
    if (error) {
      console.error("Cron: keep-warm - la query a Supabase devolvio un error:", error);
      await alertaTelegram(
        `Cron de reconciliacion: la base de datos no respondio.\nDetalle: ${error.message ?? "error desconocido"}`
      );
      return false;
    }
    return true;
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    const esConfigFaltante = e instanceof Error && e.message.includes("Faltan SUPABASE_URL");
    console.error("Cron: keep-warm - excepcion al consultar Supabase:", e);
    await alertaTelegram(
      esConfigFaltante
        ? `Cron de reconciliacion: faltan las credenciales de Supabase en el entorno.\nDetalle: ${mensaje}`
        : `Cron de reconciliacion: excepcion al consultar la base de datos.\nDetalle: ${mensaje}`
    );
    return false;
  }
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const keepWarmOk = await keepWarm();

  return Response.json({ ok: keepWarmOk }, { status: keepWarmOk ? 200 : 500 });
}
