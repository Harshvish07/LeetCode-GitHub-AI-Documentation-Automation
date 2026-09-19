/**
 * The one interface every repository in `persistence/` depends on — never
 * `pg` or PGlite directly. Mirrors the `AiProvider`/`GitHubClient`
 * dependency-inversion pattern: one real implementation (`pgDatabase.ts`,
 * the only file that imports `pg`) and one test-only implementation
 * (`pgliteDatabase.ts`, a real in-process Postgres, so repository tests run
 * genuine SQL against genuine Postgres semantics with no server to install).
 */
export interface Database {
  /** Runs one parameterized statement ($1, $2, ...) and returns its rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs one or more statements with no parameters — used by migrations. */
  exec(sql: string): Promise<void>;
  /** Runs `fn` in a transaction: committed if it resolves, rolled back if it throws. */
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
