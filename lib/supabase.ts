import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente server-only. La tabla reclamaciones tiene RLS con INSERT abierto a anon
// y sin SELECT publico; el service_role se usa aqui para poder leer de vuelta
// el row insertado y armar el folio. Nunca importar este archivo desde un
// componente cliente.
//
// Se crea de forma perezosa: si se instanciara al importar el modulo, el build
// fallaria en cualquier entorno que todavia no tenga las env vars cargadas.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
