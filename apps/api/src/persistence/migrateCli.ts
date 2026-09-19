import 'dotenv/config';
import { createDatabaseFromEnv } from './createDatabaseFromEnv.js';
import { runMigrations } from './migrate.js';

/** `npm run db:migrate -w @codereviewai/api` — applies pending migrations and exits. */
async function main(): Promise<void> {
  const db = createDatabaseFromEnv();
  if (!db) {
    console.error('[db] DATABASE_URL is not set — nothing to migrate.');
    process.exitCode = 1;
    return;
  }
  try {
    const result = await runMigrations(db);
    console.log(
      `[db] applied: ${result.applied.join(', ') || '(none)'}; already applied: ${
        result.alreadyApplied.join(', ') || '(none)'
      }`,
    );
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error('[db] migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
