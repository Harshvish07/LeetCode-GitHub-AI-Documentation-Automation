import type { Database } from './database.js';
import { migrations as allMigrations } from './migrations/index.js';
import type { Migration } from './migrations/types.js';

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

/**
 * Applies every migration not yet recorded in `schema_migrations`, in id
 * order, each in its own transaction (a failing migration leaves no
 * partial schema and is not recorded). Idempotent — safe to run on every
 * startup. Migrations are TypeScript modules rather than loose `.sql`
 * files so `tsc` bundles them into `dist/` with no copy step.
 */
export async function runMigrations(
  db: Database,
  migrations: Migration[] = allMigrations,
): Promise<MigrationResult> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         text PRIMARY KEY,
      name       text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const recorded = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const appliedIds = new Set(recorded.map((row) => row.id));

  const result: MigrationResult = { applied: [], alreadyApplied: [] };

  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (appliedIds.has(migration.id)) {
      result.alreadyApplied.push(migration.id);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [
        migration.id,
        migration.name,
      ]);
    });
    result.applied.push(migration.id);
  }

  return result;
}
