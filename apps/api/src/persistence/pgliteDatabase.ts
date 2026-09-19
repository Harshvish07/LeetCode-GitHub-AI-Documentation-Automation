import { PGlite } from '@electric-sql/pglite';
import type { Database } from './database.js';

/**
 * Test/dev-only `Database` backed by PGlite — a real Postgres compiled to
 * WebAssembly running in-process. Repository and API tests use this so they
 * execute genuine Postgres SQL (jsonb, partial semantics, DISTINCT ON, GIN
 * indexes, constraints) without a server or Docker. Excluded from the
 * production build (`apps/api/tsconfig.build.json`), like `mockProvider.ts`.
 */
export async function createPgliteDatabase(): Promise<Database> {
  const pglite = new PGlite();
  await pglite.waitReady;

  const make = (target: Pick<PGlite, 'query' | 'exec'>, isTx: boolean): Database => ({
    query: async <T>(sql: string, params?: unknown[]) =>
      (await target.query<T>(sql, params)).rows as T[],
    exec: async (sql) => {
      await target.exec(sql);
    },
    transaction: async (fn) => {
      if (isTx) throw new Error('Nested transactions are not supported.');
      return pglite.transaction((tx) => fn(make(tx as unknown as PGlite, true)));
    },
    close: async () => {
      if (!isTx) await pglite.close();
    },
  });

  return make(pglite, false);
}
