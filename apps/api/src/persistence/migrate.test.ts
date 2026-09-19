import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './database.js';
import { runMigrations } from './migrate.js';
import { DEFAULT_USER_ID } from './migrations/001_initial_schema.js';
import { createPgliteDatabase } from './pgliteDatabase.js';

let db: Database;

beforeAll(async () => {
  db = await createPgliteDatabase();
});

afterAll(async () => {
  await db.close();
});

async function tableNames(): Promise<string[]> {
  const rows = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name);
}

describe('runMigrations', () => {
  it('creates every Phase 8 table on a fresh database', async () => {
    const result = await runMigrations(db);

    expect(result.applied).toEqual(['001', '002']);
    expect(await tableNames()).toEqual(
      expect.arrayContaining([
        'users',
        'problems',
        'submissions',
        'analyses',
        'reviews',
        'documents',
        'schema_migrations',
      ]),
    );
  });

  it('is idempotent — a second run applies nothing', async () => {
    const result = await runMigrations(db);

    expect(result.applied).toEqual([]);
    expect(result.alreadyApplied).toEqual(['001', '002']);
  });

  it('records applied migrations with their names', async () => {
    const rows = await db.query<{ id: string; name: string }>(
      'SELECT id, name FROM schema_migrations',
    );
    expect(rows).toEqual([
      { id: '001', name: 'initial_schema' },
      { id: '002', name: 'enable_row_level_security' },
    ]);
  });

  it('seeds the built-in local user', async () => {
    const rows = await db.query<{ id: string; handle: string }>('SELECT id, handle FROM users');
    expect(rows).toEqual([{ id: DEFAULT_USER_ID, handle: 'local' }]);
  });

  it('creates the indexes the dashboard queries rely on', async () => {
    const rows = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const names = rows.map((row) => row.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'submissions_user_received_idx',
        'submissions_problem_received_idx',
        'problems_difficulty_idx',
        'reviews_patterns_idx',
        'analyses_patterns_idx',
      ]),
    );
  });

  it('enforces the difficulty check constraint', async () => {
    await expect(
      db.query(`INSERT INTO problems (id, slug, title, difficulty, url)
                VALUES (gen_random_uuid(), 'bad', 'Bad', 'Impossible', 'https://x')`),
    ).rejects.toThrow();
  });

  it('enforces the one-review-per-submission unique constraint', async () => {
    const indexes = await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'reviews' AND indexdef ILIKE '%unique%'`,
    );
    expect(indexes.some((row) => row.indexdef.includes('submission_id'))).toBe(true);
  });

  it('rolls back a failing migration and does not record it', async () => {
    const fresh = await createPgliteDatabase();
    try {
      await expect(
        runMigrations(fresh, [
          {
            id: '001',
            name: 'partial',
            sql: 'CREATE TABLE half_done (id int); SELECT nope_not_a_column FROM half_done;',
          },
        ]),
      ).rejects.toThrow();

      const tables = await fresh.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'half_done'`,
      );
      const recorded = await fresh.query('SELECT id FROM schema_migrations');
      expect(tables).toEqual([]);
      expect(recorded).toEqual([]);
    } finally {
      await fresh.close();
    }
  });

  it('applies new migrations in id order on top of existing ones', async () => {
    const fresh = await createPgliteDatabase();
    try {
      await runMigrations(fresh, [{ id: '001', name: 'a', sql: 'CREATE TABLE a (id int)' }]);
      const result = await runMigrations(fresh, [
        { id: '002', name: 'c', sql: 'CREATE TABLE c (id int)' },
        { id: '001', name: 'a', sql: 'CREATE TABLE a (id int)' },
        { id: '002a', name: 'b', sql: 'CREATE TABLE b (id int)' },
      ]);
      expect(result.applied).toEqual(['002', '002a']);
      expect(result.alreadyApplied).toEqual(['001']);
    } finally {
      await fresh.close();
    }
  });
});
