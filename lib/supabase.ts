import { createClient } from "@supabase/supabase-js";

// Cliente server-only. La tabla reclamaciones tiene RLS con INSERT abierto a anon
// y sin SELECT publico; el service_role se usa aqui para poder leer de vuelta
// el row insertado y armar el folio. Nunca importar este archivo desde un
// componente cliente.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
