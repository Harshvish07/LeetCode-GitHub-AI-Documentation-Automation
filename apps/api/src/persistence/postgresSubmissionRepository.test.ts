import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { storedSubmission } from '../testing/fixtures.js';
import type { Database } from './database.js';
import { runMigrations } from './migrate.js';
import { createPgliteDatabase } from './pgliteDatabase.js';
import { PostgresSubmissionRepository } from './postgresSubmissionRepository.js';

let db: Database;
let repository: PostgresSubmissionRepository;

beforeAll(async () => {
  db = await createPgliteDatabase();
  await runMigrations(db);
  repository = new PostgresSubmissionRepository(db);
});

afterAll(async () => {
  await db.close();
});

describe('PostgresSubmissionRepository', () => {
  it('round-trips a submission exactly (create then findById)', async () => {
    const submission = storedSubmission({ slug: 'round-trip', title: 'Round Trip' });

    await repository.create(submission);
    const found = await repository.findById(submission.id);

    expect(found).toEqual(submission);
  });

  it('preserves submitted code byte-for-byte, including newlines, quotes, and backticks', async () => {
    const code = 'const s = `a "b" \'c\'`;\r\n\tif (x < 1 && y > 2) {\n  return "\\n";\n}\n\n```';
    const submission = storedSubmission({ slug: 'exact-code', code });

    await repository.create(submission);
    const found = await repository.findById(submission.id);

    expect(found?.submission.code).toBe(code);
  });

  it('returns null for an id that does not exist', async () => {
    await expect(repository.findById(randomUUID())).resolves.toBeNull();
  });

  it('returns null (not an error) for an id that is not a UUID', async () => {
    await expect(repository.findById('does-not-exist')).resolves.toBeNull();
  });

  it('shares one problem row across several submissions of the same problem', async () => {
    const first = storedSubmission({ slug: 'shared-problem' });
    const second = storedSubmission({ slug: 'shared-problem', status: 'Wrong Answer' });

    await repository.create(first);
    await repository.create(second);

    const problems = await db.query('SELECT id FROM problems WHERE slug = $1', ['shared-problem']);
    const submissions = await db.query('SELECT id FROM submissions WHERE problem_id = $1', [
      (problems[0] as { id: string }).id,
    ]);
    expect(problems).toHaveLength(1);
    expect(submissions).toHaveLength(2);
  });

  it('updates problem metadata when the same slug is submitted again', async () => {
    await repository.create(
      storedSubmission({ slug: 'metadata-update', title: 'Old Title', difficulty: 'Easy' }),
    );
    await repository.create(
      storedSubmission({ slug: 'metadata-update', title: 'New Title', difficulty: 'Hard' }),
    );

    const rows = await db.query<{ title: string; difficulty: string }>(
      'SELECT title, difficulty FROM problems WHERE slug = $1',
      ['metadata-update'],
    );
    expect(rows).toEqual([{ title: 'New Title', difficulty: 'Hard' }]);
  });

  it('stores nullable fields (number, difficulty, language, status) as null', async () => {
    const submission = storedSubmission({
      slug: 'nullable-fields',
      number: null,
      difficulty: null,
      language: null,
      status: null,
    });

    await repository.create(submission);
    const found = await repository.findById(submission.id);

    expect(found?.problem.number).toBeNull();
    expect(found?.problem.difficulty).toBeNull();
    expect(found?.submission.language).toBeNull();
    expect(found?.submission.status).toBeNull();
  });

  it('rejects a submission missing its slug, title, or code', async () => {
    const submission = storedSubmission({ slug: 'no-slug' });
    submission.problem.slug = null;

    await expect(repository.create(submission)).rejects.toThrow(/slug, title, or code/);
  });

  it('rolls back the problem row when the submission insert fails', async () => {
    const submission = storedSubmission({ slug: 'rollback-check', id: randomUUID() });
    await repository.create(submission);
    const duplicate = storedSubmission({ slug: 'rollback-check-2', id: submission.id });

    await expect(repository.create(duplicate)).rejects.toThrow();

    const orphan = await db.query('SELECT id FROM problems WHERE slug = $1', ['rollback-check-2']);
    expect(orphan).toEqual([]);
  });
});
