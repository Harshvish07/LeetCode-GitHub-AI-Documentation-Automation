import 'dotenv/config';
import { createApp } from './app.js';
import { createDatabaseFromEnv } from './persistence/createDatabaseFromEnv.js';
import { runMigrations } from './persistence/migrate.js';

const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

async function main(): Promise<void> {
  const database = createDatabaseFromEnv();

  if (database) {
    const result = await runMigrations(database);
    console.log(
      `[db] connected; migrations applied: ${result.applied.join(', ') || '(none — up to date)'}`,
    );
  } else {
    console.log('[db] DATABASE_URL not set — running without a database (dashboard disabled).');
  }

  const app = createApp({ corsOrigin, database: database ?? undefined });

  app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });
}

main().catch((error: unknown) => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
