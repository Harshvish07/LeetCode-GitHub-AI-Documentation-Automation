import type {
  ApiResponse,
  AttemptComparison,
  LearningProfile,
  ProblemHistory,
  Recommendations,
} from '@codereviewai/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMockProvider } from '../ai/providers/mockProvider.js';
import { createApp } from '../app.js';
import { createInMemoryGitHubClient } from '../github/mockGitHubClient.js';
import type { Database } from '../persistence/database.js';
import { runMigrations } from '../persistence/migrate.js';
import { createPgliteDatabase } from '../persistence/pgliteDatabase.js';
import { PostgresLearningRepository } from '../persistence/postgresLearningRepository.js';
import { PostgresSubmissionRepository } from '../persistence/postgresSubmissionRepository.js';
import { aiReview, combinedReview, storedSubmission } from '../testing/fixtures.js';

let db: Database;

beforeAll(async () => {
  db = await createPgliteDatabase();
  await runMigrations(db);
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('TRUNCATE problems, submissions CASCADE');
});

function makeApp(options: { withDatabase?: boolean } = {}) {
  return createApp({
    corsOrigin: 'http://localhost:5173',
    aiProvider: createMockProvider(() => ({ text: JSON.stringify(aiReview()) })),
    githubClient: createInMemoryGitHubClient(),
    database: options.withDatabase === false ? undefined : db,
  });
}

interface SeedOptions {
  slug?: string;
  title?: string;
  number?: number;
  minute: number;
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded';
  code?: string;
  /** Record a review for this attempt; omit to leave it unreviewed. */
  review?: Parameters<typeof combinedReview>[1];
}

/**
 * Inserts one attempt with a fixed timestamp (the HTTP submission endpoint
 * stamps "now", which would make attempt order depend on clock resolution)
 * and optionally records its review. Returns the submission id.
 */
async function seedAttempt(options: SeedOptions): Promise<string> {
  const id = randomUUID();
  await new PostgresSubmissionRepository(db).create(
    storedSubmission({
      id,
      slug: options.slug ?? 'two-sum',
      title: options.title ?? 'Two Sum',
      number: options.number ?? 1,
      status: options.status,
      code: options.code ?? `// attempt at minute ${options.minute}\nreturn ${options.minute};`,
      receivedAt: new Date(Date.UTC(2026, 8, 1, 10, options.minute)).toISOString(),
    }),
  );
  if (options.review) {
    await new PostgresLearningRepository(db).recordReview(combinedReview(id, options.review));
  }
  return id;
}

const bruteForce = {
  deterministic: { detectedPatterns: [] },
  ai: {
    patterns: ['Brute Force'],
    complexity: { time: 'O(n^2)', space: 'O(1)' },
    optimality: { isOptimal: false, reasoning: 'Nested loops.' },
    correctnessConcerns: ['Fails on an empty array.'],
    improvements: ['Use a hash map.'],
    userApproach: 'Check every pair.',
  },
};
const hashMap = {
  ai: { patterns: ['Hash Map'], complexity: { time: 'O(n)', space: 'O(n)' } },
};

async function seedJourney() {
  const first = await seedAttempt({ minute: 1, status: 'Wrong Answer', review: bruteForce });
  const second = await seedAttempt({
    minute: 2,
    status: 'Time Limit Exceeded',
    review: bruteForce,
  });
  const third = await seedAttempt({ minute: 3, status: 'Accepted', review: hashMap });
  return { first, second, third };
}

async function get<T>(app: ReturnType<typeof createApp>, path: string) {
  const response = await request(app).get(path);
  return { status: response.status, body: response.body as ApiResponse<T> };
}

describe('GET /api/problems/:id/history', () => {
  it('returns every attempt in order with comparisons and an improvement story', async () => {
    const { first, second, third } = await seedJourney();
    const app = makeApp();

    // Any attempt of the problem resolves to the same history.
    for (const id of [first, second, third]) {
      const { status, body } = await get<ProblemHistory>(app, `/api/problems/${id}/history`);
      expect(status).toBe(200);
      if (!body.success) throw new Error('expected success');
      expect(body.data.attempts.map((a) => a.status)).toEqual([
        'Wrong Answer',
        'Time Limit Exceeded',
        'Accepted',
      ]);
      expect(body.data.attempts.map((a) => a.attemptNumber)).toEqual([1, 2, 3]);
    }

    const { body } = await get<ProblemHistory>(app, `/api/problems/${third}/history`);
    if (!body.success) throw new Error('expected success');
    const history = body.data;
    expect(history.problem).toMatchObject({ slug: 'two-sum', title: 'Two Sum' });
    expect(history.attempts[0]).toMatchObject({
      submissionId: first,
      reviewed: true,
      timeComplexity: 'O(n^2)',
      approach: 'Check every pair.',
      runtime: '52 ms',
    });
    expect(history.attempts[0]!.code).toContain('attempt at minute 1');
    expect(history.attempts[2]).toMatchObject({ timeComplexity: 'O(n)', patterns: ['Hash Map'] });
    expect(history.comparisons).toHaveLength(2);
    expect(history.comparisons[1]).toMatchObject({
      fromAttempt: 2,
      toAttempt: 3,
      bugFixed: true,
      algorithmChanged: true,
    });
    expect(history.comparisons[1]!.timeComplexity.change).toBe('improved');
    expect(history.overview).toMatchObject({
      outcome: 'improved',
      complexityJourney: ['O(n^2)', 'O(n)'],
      firstAcceptedAttempt: 3,
    });
  });

  it('keeps unreviewed attempts and says what it cannot compare', async () => {
    const first = await seedAttempt({ minute: 1, status: 'Wrong Answer' });
    await seedAttempt({ minute: 2, status: 'Accepted', review: hashMap });
    const { body } = await get<ProblemHistory>(makeApp(), `/api/problems/${first}/history`);
    if (!body.success) throw new Error('expected success');
    expect(body.data.attempts[0]).toMatchObject({
      reviewed: false,
      timeComplexity: null,
      qualityScore: null,
      patterns: [],
    });
    expect(body.data.comparisons[0]!.reviewedBoth).toBe(false);
    expect(body.data.comparisons[0]!.algorithmChanged).toBeNull();
    expect(body.data.comparisons[0]!.status.change).toBe('fixed');
  });

  it('separates attempts of different problems', async () => {
    const a = await seedAttempt({ minute: 1, status: 'Accepted' });
    await seedAttempt({ minute: 2, status: 'Accepted', slug: 'add-two-numbers', title: 'Add Two' });
    const { body } = await get<ProblemHistory>(makeApp(), `/api/problems/${a}/history`);
    if (!body.success) throw new Error('expected success');
    expect(body.data.attempts).toHaveLength(1);
    expect(body.data.overview.outcome).toBe('single-attempt');
  });

  it('answers 404 for an unknown or malformed id', async () => {
    const app = makeApp();
    expect((await get(app, `/api/problems/${randomUUID()}/history`)).status).toBe(404);
    expect((await get(app, '/api/problems/not-a-uuid/history')).status).toBe(404);
  });
});

describe('GET /api/problems/:id/compare', () => {
  it('compares any two attempts', async () => {
    const { first, third } = await seedJourney();
    const { status, body } = await get<AttemptComparison>(
      makeApp(),
      `/api/problems/${first}/compare?from=1&to=3`,
    );
    expect(status).toBe(200);
    if (!body.success) throw new Error('expected success');
    expect(body.data).toMatchObject({
      fromAttempt: 1,
      toAttempt: 3,
      status: { from: 'Wrong Answer', to: 'Accepted', change: 'fixed' },
      timeComplexity: { from: 'O(n^2)', to: 'O(n)', change: 'improved' },
      patterns: { added: ['Hash Map'] },
      codeQualityImproved: true,
    });
    expect(third).toBeDefined();
  });

  it('validates the query and the attempt numbers', async () => {
    const { first } = await seedJourney();
    const app = makeApp();
    expect((await get(app, `/api/problems/${first}/compare`)).status).toBe(400);
    expect((await get(app, `/api/problems/${first}/compare?from=0&to=2`)).status).toBe(400);
    expect((await get(app, `/api/problems/${first}/compare?from=a&to=2`)).status).toBe(400);
    expect((await get(app, `/api/problems/${first}/compare?from=1&to=9`)).status).toBe(404);
    expect((await get(app, `/api/problems/${randomUUID()}/compare?from=1&to=2`)).status).toBe(404);
  });
});

describe('GET /api/learning/profile and /recommendations', () => {
  it('handles an empty database', async () => {
    const app = makeApp();
    const profile = await get<LearningProfile>(app, '/api/learning/profile');
    expect(profile.status).toBe(200);
    if (!profile.body.success) throw new Error('expected success');
    expect(profile.body.data).toMatchObject({ problems: 0, attempts: 0, insights: [] });

    const recs = await get<Recommendations>(app, '/api/learning/recommendations');
    if (!recs.body.success) throw new Error('expected success');
    expect(recs.body.data).toMatchObject({ practiceMore: [], review: [], sufficientData: false });
  });

  it('derives weaknesses and recommendations from stored history', async () => {
    // Three problems, each started with a slow brute force and two with a Wrong Answer.
    for (const [index, slug] of ['a', 'b', 'c'].entries()) {
      const base = 10 * (index + 1);
      await seedAttempt({
        slug,
        title: `Problem ${slug}`,
        minute: base,
        status: 'Wrong Answer',
        review: bruteForce,
      });
      await seedAttempt({
        slug,
        title: `Problem ${slug}`,
        minute: base + 1,
        status: 'Accepted',
        review: hashMap,
      });
    }

    const app = makeApp();
    const profile = await get<LearningProfile>(app, '/api/learning/profile');
    if (!profile.body.success) throw new Error('expected success');
    expect(profile.body.data).toMatchObject({
      problems: 3,
      attempts: 6,
      reviewedAttempts: 6,
      sufficientData: true,
    });
    const ids = profile.body.data.insights.map((i) => i.id);
    expect(ids).toContain('repeated-wrong-answer');
    expect(ids).toContain('slower-first-solutions');
    expect(ids).toContain('missed-edge-cases');
    expect(ids).toContain('recovers-from-failures');
    const slower = profile.body.data.insights.find((i) => i.id === 'slower-first-solutions')!;
    expect(slower.evidence).toMatchObject({ count: 3, total: 3 });
    expect(slower.description).toContain('Hash Map');

    const recs = await get<Recommendations>(app, '/api/learning/recommendations');
    if (!recs.body.success) throw new Error('expected success');
    expect(recs.body.data.sufficientData).toBe(true);
    expect(recs.body.data.practiceMore.length).toBeGreaterThan(0);
    // Hash Map is practiced (and Accepted) on all three problems, so it is not a practice target.
    expect(recs.body.data.practiceMore.map((r) => r.pattern)).not.toContain('Hash Map');
  });
});

describe('without a database', () => {
  it('answers 503 DATABASE_NOT_CONFIGURED on every improvement endpoint', async () => {
    const app = makeApp({ withDatabase: false });
    const id = randomUUID();
    for (const path of [
      `/api/problems/${id}/history`,
      `/api/problems/${id}/compare?from=1&to=2`,
      '/api/learning/profile',
      '/api/learning/recommendations',
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(503);
      expect((response.body as { error: { code: string } }).error.code).toBe(
        'DATABASE_NOT_CONFIGURED',
      );
    }
  });
});

describe('document sections', () => {
  async function documentFor(id: string, app = makeApp()): Promise<string> {
    const response = await request(app).post(`/api/submissions/${id}/document`);
    expect(response.status).toBe(200);
    return (response.body as { data: { content: string } }).data.content;
  }

  it('adds history, improvement, and recurring-mistake sections for a multi-attempt problem', async () => {
    const first = await seedAttempt({ minute: 1, status: 'Wrong Answer', review: bruteForce });
    const second = await seedAttempt({
      minute: 2,
      status: 'Time Limit Exceeded',
      review: bruteForce,
    });
    const third = await seedAttempt({ minute: 3, status: 'Accepted' });
    expect([first, second]).toHaveLength(2);

    const content = await documentFor(third);
    expect(content).toContain('## Submission History');
    expect(content).toContain('| 1 |');
    expect(content).toContain('| 3 |');
    expect(content).toContain('## How My Solution Improved');
    expect(content).toContain('Status path: Wrong Answer (attempt 1)');
    expect(content).toContain('**Attempt 2 → 3**');
    // The third attempt was reviewed by this request, so its review data is in the table.
    expect(content).toMatch(/\| 3 \|[^\n]*Accepted[^\n]*O\(n\)/);
  });

  it('adds Recurring Mistakes only when the history supports one', async () => {
    await seedAttempt({ slug: 'p1', minute: 1, status: 'Time Limit Exceeded' });
    await seedAttempt({ slug: 'p2', minute: 2, status: 'Time Limit Exceeded' });
    const third = await seedAttempt({ slug: 'p3', minute: 3, status: 'Accepted' });
    const content = await documentFor(third);
    expect(content).toContain('## Recurring Mistakes');
    expect(content).toContain('Repeated Time Limit Exceeded');
    // A single-attempt problem gets no history sections.
    expect(content).not.toContain('## Submission History');
  });

  it('describes the moment of writing — later attempts are not included', async () => {
    const first = await seedAttempt({ minute: 1, status: 'Wrong Answer' });
    await seedAttempt({ minute: 2, status: 'Accepted' });
    const content = await documentFor(first);
    expect(content).not.toContain('## Submission History');
  });

  it('omits every improvement section when the history is empty of evidence', async () => {
    const only = await seedAttempt({ minute: 1, status: 'Accepted' });
    const content = await documentFor(only);
    expect(content).not.toContain('## Submission History');
    expect(content).not.toContain('## How My Solution Improved');
    expect(content).not.toContain('## Recurring Mistakes');
  });

  it('still generates the document without a database', async () => {
    const app = makeApp({ withDatabase: false });
    const submitted = await request(app)
      .post('/api/submissions')
      .send({
        problem: {
          url: 'https://leetcode.com/problems/two-sum/',
          slug: 'two-sum',
          number: 1,
          title: 'Two Sum',
          difficulty: 'Easy',
          description: 'Solve.',
        },
        submission: {
          language: 'JavaScript',
          code: 'var f = function() { return 1; };',
          status: 'Accepted',
          runtime: '1 ms',
          memory: '1 MB',
        },
        metadata: { extractedAt: new Date().toISOString(), source: 'extension' },
      });
    const id = (submitted.body as { data: { id: string } }).data.id;
    const content = await documentFor(id, app);
    expect(content).toContain('# LeetCode Problem: Two Sum');
    expect(content).not.toContain('## Submission History');
  });
});
