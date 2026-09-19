import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { combinedReview, storedSubmission } from '../testing/fixtures.js';
import type { Database } from './database.js';
import { runMigrations } from './migrate.js';
import { createPgliteDatabase } from './pgliteDatabase.js';
import { PostgresLearningRepository } from './postgresLearningRepository.js';
import { PostgresSubmissionRepository } from './postgresSubmissionRepository.js';

let db: Database;
let submissions: PostgresSubmissionRepository;
let learning: PostgresLearningRepository;

beforeAll(async () => {
  db = await createPgliteDatabase();
  await runMigrations(db);
  submissions = new PostgresSubmissionRepository(db);
  learning = new PostgresLearningRepository(db);
});

afterAll(async () => {
  await db.close();
});

describe('PostgresLearningRepository — recording a review', () => {
  it('stores the analysis and review, and reports them in the problem records', async () => {
    const submission = storedSubmission({ slug: 'reviewed-one', title: 'Reviewed One' });
    await submissions.create(submission);

    await learning.recordReview(combinedReview(submission.id));

    const record = (await learning.listProblemRecords()).find((r) => r.slug === 'reviewed-one')!;
    expect(record.reviewed).toBe(true);
    expect(record.staticPatterns).toEqual(['Hash Map']);
    expect(record.aiPatterns).toEqual(['Hash Map']);
    expect(record.staticTimeComplexity).toBe('O(n)');
    expect(record.aiTimeComplexity).toBe('O(n)');
    expect(record.isOptimal).toBe(true);
    expect(record.qualityScore).toBe(100);
    expect(record.correctnessConcernsCount).toBe(0);
  });

  it('computes and stores the quality score from the review', async () => {
    const submission = storedSubmission({ slug: 'quality-score' });
    await submissions.create(submission);

    await learning.recordReview(
      combinedReview(submission.id, {
        ai: {
          optimality: { isOptimal: false, reasoning: 'A hash map is faster.' },
          improvements: ['Use a map.'],
          correctnessConcerns: ['Fails on empty input.'],
        },
      }),
    );

    const record = (await learning.listProblemRecords()).find((r) => r.slug === 'quality-score')!;
    // 100 - 25 (not optimal) - 12 (one concern) - 4 (one improvement)
    expect(record.qualityScore).toBe(59);
    expect(record.correctnessConcernsCount).toBe(1);
  });

  it('replaces the previous analysis and review when a submission is re-reviewed', async () => {
    const submission = storedSubmission({ slug: 're-review' });
    await submissions.create(submission);

    await learning.recordReview(combinedReview(submission.id));
    await learning.recordReview(
      combinedReview(submission.id, { ai: { optimality: { isOptimal: false, reasoning: 'no' } } }),
    );

    const reviews = await db.query('SELECT id FROM reviews WHERE submission_id = $1', [
      submission.id,
    ]);
    const analyses = await db.query('SELECT id FROM analyses WHERE submission_id = $1', [
      submission.id,
    ]);
    const record = (await learning.listProblemRecords()).find((r) => r.slug === 're-review')!;
    expect(reviews).toHaveLength(1);
    expect(analyses).toHaveLength(1);
    expect(record.isOptimal).toBe(false);
  });

  it('rejects a review for a submission that does not exist (foreign key)', async () => {
    await expect(learning.recordReview(combinedReview(randomUUID()))).rejects.toThrow();
  });

  it('rolls back the analysis when the review insert fails', async () => {
    const submission = storedSubmission({ slug: 'atomic-review' });
    await submissions.create(submission);
    const broken = combinedReview(submission.id);
    (broken.ai as { confidence: string }).confidence = 'certain'; // violates the CHECK constraint

    await expect(learning.recordReview(broken)).rejects.toThrow();

    const analyses = await db.query('SELECT id FROM analyses WHERE submission_id = $1', [
      submission.id,
    ]);
    expect(analyses).toEqual([]);
  });
});

describe('PostgresLearningRepository — listing problems', () => {
  it('includes submissions that have never been reviewed, with null quality', async () => {
    const submission = storedSubmission({ slug: 'never-reviewed', status: 'Wrong Answer' });
    await submissions.create(submission);

    const record = (await learning.listProblemRecords()).find((r) => r.slug === 'never-reviewed')!;

    expect(record.reviewed).toBe(false);
    expect(record.qualityScore).toBeNull();
    expect(record.isOptimal).toBeNull();
    expect(record.staticPatterns).toEqual([]);
    expect(record.status).toBe('Wrong Answer');
  });

  it('returns one record per problem — the latest submission', async () => {
    const older = storedSubmission({
      slug: 'resubmitted',
      status: 'Wrong Answer',
      receivedAt: '2026-09-10T10:00:00.000Z',
    });
    const newer = storedSubmission({
      slug: 'resubmitted',
      status: 'Accepted',
      receivedAt: '2026-09-12T10:00:00.000Z',
    });
    await submissions.create(older);
    await submissions.create(newer);

    const records = (await learning.listProblemRecords()).filter((r) => r.slug === 'resubmitted');

    expect(records).toHaveLength(1);
    expect(records[0]!.submissionId).toBe(newer.id);
    expect(records[0]!.status).toBe('Accepted');
    expect(records[0]!.submittedAt).toBe('2026-09-12T10:00:00.000Z');
  });

  it('lists every submission timestamp as activity dates (for streaks)', async () => {
    const dates = await learning.listActivityDates();

    expect(dates).toEqual(
      expect.arrayContaining(['2026-09-10T10:00:00.000Z', '2026-09-12T10:00:00.000Z']),
    );
    expect(dates.every((d) => !Number.isNaN(Date.parse(d)))).toBe(true);
  });
});

describe('PostgresLearningRepository — documents and GitHub publication', () => {
  it('stores a generated document without a GitHub link at first', async () => {
    const submission = storedSubmission({ slug: 'doc-only' });
    await submissions.create(submission);
    await learning.recordReview(combinedReview(submission.id));

    await learning.recordDocument(submission.id, { filename: '001-doc-only.md', content: '# Doc' });

    const detail = await learning.getProblemDetail(submission.id);
    expect(detail?.document).toEqual({
      filename: '001-doc-only.md',
      githubUrl: null,
      publishedAt: null,
    });
  });

  it('records the GitHub link once published, and surfaces it in the problem list', async () => {
    const submission = storedSubmission({ slug: 'published-doc' });
    await submissions.create(submission);
    await learning.recordReview(combinedReview(submission.id));
    await learning.recordDocument(submission.id, {
      filename: '001-published-doc.md',
      content: '# Doc',
    });

    await learning.recordPublication(submission.id, {
      path: 'problems/001-published-doc/README.md',
      documentUrl: 'https://github.com/me/journal/blob/main/problems/001-published-doc/README.md',
      commitUrl: 'https://github.com/me/journal/commit/abc',
      publishedAt: '2026-09-19T11:00:00.000Z',
    });

    const record = (await learning.listProblemRecords()).find((r) => r.slug === 'published-doc')!;
    const detail = await learning.getProblemDetail(submission.id);
    expect(record.githubUrl).toBe(
      'https://github.com/me/journal/blob/main/problems/001-published-doc/README.md',
    );
    expect(detail?.document?.publishedAt).toBe('2026-09-19T11:00:00.000Z');
  });

  it('keeps a single document row per submission when re-generated', async () => {
    const submission = storedSubmission({ slug: 'regenerated-doc' });
    await submissions.create(submission);

    await learning.recordDocument(submission.id, { filename: 'a.md', content: 'one' });
    await learning.recordDocument(submission.id, { filename: 'a.md', content: 'two' });

    const rows = await db.query<{ content: string }>(
      'SELECT content FROM documents WHERE submission_id = $1',
      [submission.id],
    );
    expect(rows).toEqual([{ content: 'two' }]);
  });
});

describe('PostgresLearningRepository — problem detail', () => {
  it('assembles problem, submission, analysis, review, and quality', async () => {
    const submission = storedSubmission({ slug: 'full-detail', title: 'Full Detail', number: 7 });
    await submissions.create(submission);
    await learning.recordReview(
      combinedReview(submission.id, {
        ai: {
          optimality: { isOptimal: false, reasoning: 'Can be faster.' },
          betterApproach: {
            description: 'Use a map.',
            pseudocode: '1. build map',
            code: 'const m = new Map();',
            complexity: { time: 'O(n)', space: 'O(n)' },
            whyBetter: 'Linear time.',
          },
          learningPoints: ['Trade space for time.'],
        },
      }),
    );

    const detail = await learning.getProblemDetail(submission.id);

    expect(detail?.problem).toMatchObject({
      number: 7,
      slug: 'full-detail',
      title: 'Full Detail',
      difficulty: 'Easy',
    });
    expect(detail?.submission.code).toBe(submission.submission.code);
    expect(detail?.submission.submittedAt).toBe('2026-09-19T10:00:00.000Z');
    expect(detail?.analysis?.patterns).toEqual([{ pattern: 'Hash Map', confidence: 'high' }]);
    expect(detail?.analysis?.timeComplexity).toEqual({ notation: 'O(n)', confidence: 'high' });
    expect(detail?.analysis?.edgeCaseObservations[0]?.concern).toBe('Empty input');
    expect(detail?.review?.betterApproach?.code).toBe('const m = new Map();');
    expect(detail?.review?.learningPoints).toEqual(['Trade space for time.']);
    expect(detail?.review?.agreement.hasDisagreement).toBe(false);
    expect(detail?.qualityScore).toBe(75);
  });

  it('returns null analysis, review, and document for an unreviewed submission', async () => {
    const submission = storedSubmission({ slug: 'bare-detail' });
    await submissions.create(submission);

    const detail = await learning.getProblemDetail(submission.id);

    expect(detail?.analysis).toBeNull();
    expect(detail?.review).toBeNull();
    expect(detail?.document).toBeNull();
    expect(detail?.qualityScore).toBeNull();
  });

  it('returns null for an unknown submission id', async () => {
    await expect(learning.getProblemDetail(randomUUID())).resolves.toBeNull();
  });

  it('returns null (not an error) for an id that is not a UUID', async () => {
    await expect(learning.getProblemDetail('nope')).resolves.toBeNull();
  });

  it("does not expose another user's submissions", async () => {
    const submission = storedSubmission({ slug: 'someone-elses' });
    await submissions.create(submission);
    const otherUser = new PostgresLearningRepository(db, randomUUID());

    await expect(otherUser.getProblemDetail(submission.id)).resolves.toBeNull();
    await expect(otherUser.listProblemRecords()).resolves.toEqual([]);
  });
});
