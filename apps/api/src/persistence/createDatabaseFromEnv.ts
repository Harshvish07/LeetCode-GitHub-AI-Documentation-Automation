import type { Database } from './database.js';
import { createPgDatabase } from './pgDatabase.js';

/**
 * Builds the real `Database` from `DATABASE_URL` (and optional
 * `DATABASE_SSL`), or returns `null` when it isn't set — the API then
 * runs exactly as it did before Phase 8 (in-memory submissions, no
 * dashboard), so nothing requires Postgres to start. Called only from
 * `index.ts`; every test injects a PGlite database instead.
 */
export function createDatabaseFromEnv(env: NodeJS.ProcessEnv = process.env): Database | null {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  return createPgDatabase({ connectionString, ssl: shouldUseSsl(connectionString, env) });
}

/**
 * TLS is on when `DATABASE_SSL=true`, and by default for Supabase hosts
 * (which require it); `DATABASE_SSL=false` turns it off explicitly.
 */
export function shouldUseSsl(connectionString: string, env: NodeJS.ProcessEnv): boolean {
  if (env.DATABASE_SSL === 'true') return true;
  if (env.DATABASE_SSL === 'false') return false;
  try {
    const host = new URL(connectionString).hostname;
    return /(^|\.)supabase\.(co|com)$/.test(host);
  } catch {
    return false;
  }
}
