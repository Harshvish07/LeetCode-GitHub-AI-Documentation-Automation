import pg from 'pg';
import type { Database } from './database.js';

export interface PgDatabaseConfig {
  connectionString: string;
  /** Set for hosted Postgres that requires TLS. */
  ssl?: boolean;
  max?: number;
}

/**
 * The one real `Database` implementation, and the only file that imports
 * `pg`. The connection string comes from `DATABASE_URL` (see
 * `createDatabaseFromEnv.ts`) — never hardcoded, never logged.
 */
export function createPgDatabase(config: PgDatabaseConfig): Database {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    max: config.max ?? 10,
  });

  return wrap(
    {
      query: async (sql, params) => (await pool.query(sql, params as unknown[] | undefined)).rows,
      exec: async (sql) => {
        await pool.query(sql);
      },
    },
    async <T>(fn: (tx: Database) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = wrap(
          {
            query: async (sql, params) =>
              (await client.query(sql, params as unknown[] | undefined)).rows,
            exec: async (sql) => {
              await client.query(sql);
            },
          },
          () => Promise.reject(new Error('Nested transactions are not supported.')),
          async () => {},
        );
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    () => pool.end(),
  );
}

function wrap(
  core: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    exec: (sql: string) => Promise<void>;
  },
  transaction: Database['transaction'],
  close: () => Promise<void>,
): Database {
  return {
    query: (sql, params) => core.query(sql, params) as Promise<never[]>,
    exec: core.exec,
    transaction,
    close,
  };
}
