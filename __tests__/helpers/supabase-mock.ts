// Mock encadenable de getSupabaseAdmin(), reusado por los planes 01-03,
// 01-05, 01-06, 01-07 y 01-08 (rate limit, webhook, cron, etc). Soporta las
// dos cadenas que hoy usa app/api/charge/route.ts:
//   .from("pedidos").insert({...}).select("codigo").single()
//   .from("pedidos").select("codigo").eq("culqi_charge_id", id).single()
// y registra los argumentos de cada eslabon para poder hacer asserts sobre
// la fila insertada o la columna/valor consultados.

export type SupabaseSingleResult<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type SupabaseMockConfig<TRow extends Record<string, unknown> = Record<string, unknown>> = {
  // Resultado de .insert(...).select(...).single()
  insertResult: SupabaseSingleResult<TRow>;
  // Resultado de .select(...).eq(...).single() -- usado en la rama 23505
  selectEqResult?: SupabaseSingleResult<TRow>;
};

export type SupabaseMockCalls = {
  table: string[];
  insertArgs: Record<string, unknown>[];
  selectEqArgs: { column: string; value: unknown }[];
};

export function createSupabaseMock<TRow extends Record<string, unknown> = Record<string, unknown>>(
  config: SupabaseMockConfig<TRow>
) {
  const calls: SupabaseMockCalls = {
    table: [],
    insertArgs: [],
    selectEqArgs: [],
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
                  config.selectEqResult ?? { data: null, error: null },
              };
            },
          };
        },
      };
    },
  };

  return { client, calls };
}
