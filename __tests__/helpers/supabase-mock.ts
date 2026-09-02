// Mock encadenable de getSupabaseAdmin(), reusado por los planes 01-03 a 01-08,
// y extendido aditivamente para el plan 02-01 (menú y control de stock):
//   .from("menu_items").select(...).order("category").order("id") -> selectOrderResult
//   .from("menu_items").update(patch).eq("id", id) -> updateResult

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
  insertResult?: SupabaseSingleResult<TRow>;
  selectEqResult?: SupabaseSingleResult<TRow>;
  selectEqResultByValue?: Record<string, SupabaseSingleResult<TRow>>;
  selectLimitResult?: SupabaseListResult<TRow>;
  selectOrderResult?: SupabaseListResult<TRow>;
  updateResult?: { error: { code?: string; message?: string } | null };
  rpcResults?: SupabaseRpcResult[];
};

// Cadena recursiva de .order(): supabase-js permite encadenar N .order() y
// recien resuelve al await, sin .single(). Es thenable, no Promise.
export type SupabaseOrderChain<TRow> = {
  order(col: string): SupabaseOrderChain<TRow>;
  then(
    resolve: (value: SupabaseListResult<TRow>) => unknown,
    reject?: (reason: unknown) => unknown
  ): Promise<unknown>;
};

export type SupabaseMockCalls = {
  table: string[];
  insertArgs: Record<string, unknown>[];
  selectEqArgs: { column: string; value: unknown }[];
  selectLimitArgs: number[];
  selectOrderArgs: string[];
  updateArgs: Record<string, unknown>[];
  updateEqArgs: { column: string; value: unknown }[];
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
    selectOrderArgs: [],
    updateArgs: [],
    updateEqArgs: [],
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
        update(patch: Record<string, unknown>) {
          calls.updateArgs.push(patch);
          return {
            eq(column: string, value: unknown) {
              calls.updateEqArgs.push({ column, value });
              return Promise.resolve(config.updateResult ?? { error: null });
            },
          };
        },
        select() {
          function makeOrderChain(): SupabaseOrderChain<TRow> {
            return {
              order(col: string) {
                calls.selectOrderArgs.push(col);
                return makeOrderChain();
              },
              then(resolve, reject) {
                return Promise.resolve(config.selectOrderResult ?? { data: [], error: null }).then(resolve, reject);
              },
            };
          }

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
            limit(n: number) {
              calls.selectLimitArgs.push(n);
              return Promise.resolve(config.selectLimitResult ?? { data: [], error: null });
            },
            order(col: string) {
              calls.selectOrderArgs.push(col);
              return makeOrderChain();
            },
          };
        },
      };
    },
    async rpc(fn: string, params?: Record<string, unknown>) {
      calls.rpcArgs.push({ fn, params });
      const results = config.rpcResults ?? [];
      if (results.length === 0) {
        return { data: 1, error: null };
      }
      const index = Math.min(calls.rpcArgs.length - 1, results.length - 1);
      return results[index] ?? { data: 1, error: null };
    },
  };

  return { client, calls };
}
