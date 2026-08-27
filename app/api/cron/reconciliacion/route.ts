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
//
// Reconciliacion (D-12): la unica accion permitida ante un cargo confirmado
// en Culqi sin fila correspondiente es alertar. Esta ruta NUNCA crea un
// pedido por su cuenta -- la decision queda en manos de un humano. Corre
// solo si el keep-warm paso primero (si la base ya esta caida, comparar
// contra ella no sirve).
//
// D-10: cero logica sobre cuantas veces Culqi vuelve a mandar un evento o
// cuanto tiempo lleva un cargo sin pedido -- esos numeros no estan
// documentados. Se compara el estado real de los dos lados una vez al dia.
//
// Ver .planning/phases/01-integridad-del-pago-y-red-de-seguridad/01-CULQI-FLUJO.md
// para el hallazgo (PARCIAL) sobre el formato real de GET /v2/charges.

import { getSupabaseAdmin } from "@/lib/supabase";
import { alertaTelegram } from "@/lib/alertas";

// Cuantos cargos recientes se revisan por pasada. Alcanza para un dia de
// operacion normal del local; si se salta una ejecucion (Vercel Hobby es
// best-effort, RESEARCH.md Pattern 3), la siguiente pasada igual cubre lo
// que falto con margen.
const CARGOS_A_REVISAR = 20;

type CargoResumen = { id: string; amount: number; email: string };

// Lista los cargos mas recientes en Culqi. SOLO usa el parametro "limit":
// el formato de un filtro de fecha no se pudo confirmar contra la API real
// (sin CULQI_SECRET_KEY disponible en este entorno de ejecucion, ver
// 01-CULQI-FLUJO.md) -- se acota el alcance a lo unico verificable en vez
// de inventar parametros.
async function listarCargosRecientes(secretKey: string): Promise<CargoResumen[]> {
  const res = await fetch(`https://api.culqi.com/v2/charges?limit=${CARGOS_A_REVISAR}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  // Defensivo: la forma exacta de la respuesta de listado tampoco esta
  // confirmada (solo se verifico GET /v2/charges/{id} en el plan 01-07).
  // Se tolera tanto un array plano como { data: [...] }.
  const lista: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

  const cargos: CargoResumen[] = [];
  for (const c of lista) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    cargos.push({
      id: r.id,
      amount: typeof r.amount === "number" ? r.amount : 0,
      email: typeof r.email === "string" ? r.email : "",
    });
  }
  return cargos;
}

async function tienePedido(cargoId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("pedidos")
    .select("codigo")
    .eq("culqi_charge_id", cargoId)
    .single();
  return !!data;
}

async function alertarCargoHuerfano(cargo: CargoResumen): Promise<void> {
  await alertaTelegram(
    `Cron de reconciliacion: cargo confirmado en Culqi sin pedido en Supabase.\n` +
      `Cargo Culqi: ${cargo.id}\n` +
      `Monto: S/${(cargo.amount / 100).toFixed(2)}\n` +
      `Email: ${cargo.email || "desconocido"}\n` +
      `Revisar manualmente en CulqiPanel -- este cron nunca crea el pedido solo.`
  );
}

async function reconciliar(): Promise<void> {
  const secretKey = process.env.CULQI_SECRET_KEY;
  if (!secretKey) {
    await alertaTelegram(
      "Cron de reconciliacion: falta CULQI_SECRET_KEY en el entorno, no se pudo revisar cargos huerfanos."
    );
    return;
  }

  let cargos: CargoResumen[];
  try {
    cargos = await listarCargosRecientes(secretKey);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await alertaTelegram(`Cron de reconciliacion: fallo la consulta a Culqi.\nDetalle: ${mensaje}`);
    return;
  }

  // Idempotencia dentro de la misma pasada (Vercel Hobby puede entregar
  // resultados con cargos repetidos, o Culqi puede devolver el mismo id mas
  // de una vez): cada id se evalua una sola vez por ejecucion.
  const vistos = new Set<string>();
  for (const cargo of cargos) {
    if (vistos.has(cargo.id)) continue;
    vistos.add(cargo.id);

    const existe = await tienePedido(cargo.id);
    if (!existe) {
      await alertarCargoHuerfano(cargo);
    }
  }
}

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

  // La reconciliacion solo tiene sentido si la base respondio -- comparar
  // contra una base caida no aporta nada. Su propio fallo (Culqi caido) no
  // debe anular un keep-warm que ya paso (caso 9, D-16).
  if (keepWarmOk) {
    try {
      await reconciliar();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      console.error("Cron: excepcion durante la reconciliacion:", e);
      await alertaTelegram(`Cron de reconciliacion: excepcion durante la reconciliacion.\nDetalle: ${mensaje}`);
    }
  }

  return Response.json({ ok: keepWarmOk }, { status: keepWarmOk ? 200 : 500 });
}
