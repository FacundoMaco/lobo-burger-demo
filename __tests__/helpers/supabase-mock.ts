// Mock encadenable de getSupabaseAdmin(), reusado por los planes 01-03,
// 01-05, 01-06, 01-07 y 01-08 (rate limit, webhook, cron, etc). Soporta las
// dos cadenas que hoy usa app/api/charge/route.ts:
//   .from("pedidos").insert({...}).select("codigo").single()
//   .from("pedidos").select("codigo").eq("culqi_charge_id", id).single()
// y registra los argumentos de cada eslabon para poder hacer asserts sobre
// la fila insertada o la columna/valor consultados.
//
// Tambien soporta .rpc(nombre, params), agregado en el plan 01-06 para
// contarIntento() de lib/rate-limit.ts, que llama al RPC increment_rate_limit
// en vez de usar .from(). El resultado es configurable por llamada via
// rpcResults (array consumido en orden) para poder simular contadores
// crecientes en un mismo test.
//
// El plan 01-08 (cron de reconciliacion) agrega dos capacidades aditivas,
// sin tocar el comportamiento que ya usan los planes anteriores:
//   .from("pedidos").select("id").limit(1) -- keep-warm, thenable directo
//     (config.selectLimitResult), igual que el query builder real de
//     supabase-js cuando no se llama a .single()/.maybeSingle().
//   selectEqResultByValue -- variante de selectEqResult que permite un
//     resultado distinto por cada valor consultado en .eq(), necesario
//     porque el cron revisa varios culqi_charge_id en la misma pasada y
//     cada uno puede tener o no fila en "pedidos".

export type SupabaseSingleResult<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type SupabaseRpcResult<T = unknown> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type SupabaseListResult<T = unknown> = {
  data: T[] | null;
  error: { code?: string; message?: string } | null;
};

export type SupabaseMockConfig<TRow extends Record<string, unknown> = Record<string, unknown>> = {
  // Resultado de .insert(...).select(...).single()
  insertResult?: SupabaseSingleResult<TRow>;
  // Resultado de .select(...).eq(...).single() -- usado en la rama 23505
  selectEqResult?: SupabaseSingleResult<TRow>;
  // Resultado de .select(...).eq(column, value).single() segun el valor
  // consultado (clave = String(value)). Si el valor no esta en el mapa, cae
  // a selectEqResult.
  selectEqResultByValue?: Record<string, SupabaseSingleResult<TRow>>;
  // Resultado de .select(...).limit(n) -- keep-warm del cron (plan 01-08).
  selectLimitResult?: SupabaseListResult<TRow>;
  // Resultados de .rpc(...), consumidos en orden de llamada. Si se agotan,
  // se repite el ultimo.
  rpcResults?: SupabaseRpcResult[];
};

export type SupabaseMockCalls = {
  table: string[];
  insertArgs: Record<string, unknown>[];
  selectEqArgs: { column: string; value: unknown }[];
  selectLimitArgs: number[];
  rpcArgs: { fn: string; params: Record<string, unknown> | undefined }[];
};

export function createSupabaseMock<TRow extends Record<string, unknown> = Record<string, unknown>>(
  config: SupabaseMockConfig<TRow>
) {
  const calls: SupabaseMockCalls = {
    table: [],
    insertArgs: [],
    selectEqArgs: [],
    selectLimitArgs: [],
    rpcArgs: [],
  };

  const client = {
    from(table: string) {
      calls.table.push(table);
      return {
        insert(row: Record<string, unknown>) {
          calls.insertArgs.push(row);
          return {
            select() {
              return {
                single: async () => config.insertResult,
              };
            },
          };
        },
        select() {
          return {
            eq(column: string, value: unknown) {
              calls.selectEqArgs.push({ column, value });
              return {
                single: async () =>
                  config.selectEqResultByValue?.[String(value)] ??
                  config.selectEqResult ??
                  { data: null, error: null },
              };
            },
            // Thenable directo, sin .single(): igual que el query builder
            // real de supabase-js cuando se espera una lista, no una fila.
            limit(n: number) {
              calls.selectLimitArgs.push(n);
              return Promise.resolve(config.selectLimitResult ?? { data: [], error: null });
            },
          };
        },
      };
    },
    async rpc(fn: string, params?: Record<string, unknown>) {
      calls.rpcArgs.push({ fn, params });
      const results = config.rpcResults ?? [];
      if (results.length === 0) {
        // Default para tests que no configuran rpcResults porque no les
        // importa el rate limit (validacion, alertas, caracterizacion):
        // "primer intento", nunca bloquea y nunca dispara la alerta de
        // fail-open.
        return { data: 1, error: null };
      }
      const index = Math.min(calls.rpcArgs.length - 1, results.length - 1);
      return results[index] ?? { data: 1, error: null };
    },
  };

  return { client, calls };
}
