import type {
  ApiResponse,
  DashboardSummary,
  PatternStat,
  ProblemDetail,
  ProblemListItem,
} from '@codereviewai/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { createMockProvider } from '../ai/providers/mockProvider.js';
import { createInMemoryGitHubClient } from '../github/mockGitHubClient.js';
import type { Database } from '../persistence/database.js';
import { runMigrations } from '../persistence/migrate.js';
import { createPgliteDatabase } from '../persistence/pgliteDatabase.js';
import { aiReview } from '../testing/fixtures.js';

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

// The AI fixtures below deliberately repeat what the real static analyzer reports for each
// snippet (patterns and complexity), so no review here triggers the -5 "static and AI
// disagreed" quality penalty and the expected scores stay easy to read.
const MAP_CODE =
  'var f = function(nums) { const m = new Map(); for (const n of nums) m.set(n, 1); return []; };';
const POINTER_CODE =
  'var f = function(nums) { nums.sort((a, b) => a - b); let left = 0; let right = nums.length - 1; while (left < right) { left++; right--; } return []; };';

const PROBLEMS = {
  'Two Sum': {
    slug: 'two-sum',
    number: 1,
    difficulty: 'Easy',
    status: 'Accepted',
    code: MAP_CODE,
    ai: aiReview({ patterns: ['Hash Map'], complexity: { time: 'O(1)', space: 'O(n)' } }),
  },
  '3Sum': {
    slug: '3sum',
    number: 15,
    difficulty: 'Medium',
    status: 'Accepted',
    code: POINTER_CODE,
    ai: aiReview({
      patterns: ['Two Pointers', 'Sorting', 'Binary Search'],
      complexity: { time: 'O(log n)', space: 'O(1)' },
      optimality: { isOptimal: false, reasoning: 'Fine, but can prune duplicates sooner.' },
      improvements: ['Skip duplicates earlier.'],
    }),
  },
  'Trapping Rain Water': {
    slug: 'trapping-rain-water',
    number: 42,
    difficulty: 'Hard',
    status: 'Wrong Answer',
    code: MAP_CODE,
    ai: aiReview({ patterns: ['Hash Map'] }),
  },
} as const;

type ProblemTitle = keyof typeof PROBLEMS;

function makeApp(options: { withDatabase?: boolean } = {}) {
  const provider = createMockProvider((req) => {
    const title = (Object.keys(PROBLEMS) as ProblemTitle[]).find((t) =>
      req.userPrompt.includes(`Title: ${t}\n`),
    );
    return { text: JSON.stringify(title ? PROBLEMS[title].ai : aiReview()) };
  });
  return createApp({
    corsOrigin: 'http://localhost:5173',
    aiProvider: provider,
    githubClient: createInMemoryGitHubClient(),
    database: options.withDatabase === false ? undefined : db,
  });
}

async function submit(app: ReturnType<typeof createApp>, title: ProblemTitle): Promise<string> {
  const problem = PROBLEMS[title];
  const response = await request(app)
    .post('/api/submissions')
    .send({
      problem: {
        url: `https://leetcode.com/problems/${problem.slug}/`,
        slug: problem.slug,
        number: problem.number,
        title,
        difficulty: problem.difficulty,
        description: `Solve ${title}.`,
      },
      submission: {
        language: 'JavaScript',
        code: problem.code,
        status: problem.status,
        runtime: '52 ms',
        memory: '42.1 MB',
      },
      metadata: { extractedAt: new Date().toISOString(), source: 'extension' },
    });
  expect(response.status).toBe(201);
  return (response.body as ApiResponse<{ id: string }>).success
    ? (response.body as { data: { id: string } }).data.id
    : '';
}

async function seed(app: ReturnType<typeof createApp>) {
  const twoSum = await submit(app, 'Two Sum');
  const threeSum = await submit(app, '3Sum');
  const rain = await submit(app, 'Trapping Rain Water');
  await request(app).post(`/api/submissions/${twoSum}/review`).expect(200);
  await request(app).post(`/api/submissions/${threeSum}/review`).expect(200);
  return { twoSum, threeSum, rain };
}

function data<T>(response: request.Response): T {
  const body = response.body as ApiResponse<T>;
  if (!body.success) throw new Error(`expected success, got ${JSON.stringify(body)}`);
  return body.data;
}

describe('GET /api/dashboard/summary', () => {
  it('reports totals, optimal/needing-improvement counts, and difficulty distribution', async () => {
    const app = makeApp();
    await seed(app);

    const summary = data<DashboardSummary>(
      await request(app).get('/api/dashboard/summary').expect(200),
    );

    expect(summary.totalProblems).toBe(3);
    expect(summary.acceptedSolutions).toBe(2);
    expect(summary.optimalSolutions).toBe(1);
    expect(summary.needingImprovement).toBe(1);
    expect(summary.unreviewed).toBe(1);
    expect(summary.difficultyDistribution).toEqual({ Easy: 1, Medium: 1, Hard: 1, Unknown: 0 });
    expect(summary.patternsPracticed).toBe(4); // Hash Map, Two Pointers, Sorting, Binary Search
    expect(summary.currentStreak).toBe(1);
    expect(summary.recentProblems).toHaveLength(3);
  });

  it('returns all zeros for an empty database', async () => {
    const summary = data<DashboardSummary>(
      await request(makeApp()).get('/api/dashboard/summary').expect(200),
    );

    expect(summary.totalProblems).toBe(0);
    expect(summary.currentStreak).toBe(0);
    expect(summary.recentProblems).toEqual([]);
  });

  it('computes the streak relative to an injected clock', async () => {
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createMockProvider(() => ({ text: JSON.stringify(aiReview()) })),
      githubClient: createInMemoryGitHubClient(),
      database: db,
      now: () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    await submit(app, 'Two Sum');

    const summary = data<DashboardSummary>(
      await request(app).get('/api/dashboard/summary').expect(200),
    );

    expect(summary.currentStreak).toBe(0); // last activity was 5 days before "today"
    expect(summary.longestStreak).toBe(1);
  });
});

describe('GET /api/dashboard/patterns', () => {
  it('returns stats for every tracked pattern, with quality and improvement opportunities', async () => {
    const app = makeApp();
    await seed(app);

    const stats = data<PatternStat[]>(
      await request(app).get('/api/dashboard/patterns').expect(200),
    );
    const byName = (name: string) => stats.find((s) => s.pattern === name)!;

    expect(stats).toHaveLength(16);
    expect(byName('Hash Map')).toMatchObject({
      solved: 1,
      averageQuality: 100,
      improvementOpportunities: 0,
    });
    // 100 - 25 (not optimal) - 4 (one improvement)
    expect(byName('Two Pointers')).toMatchObject({
      solved: 1,
      averageQuality: 71,
      improvementOpportunities: 1,
    });
    expect(byName('Two Pointers').revisit[0]?.title).toBe('3Sum');
    expect(byName('Heap')).toMatchObject({ solved: 0, averageQuality: null });
  });
});

describe('GET /api/problems', () => {
  it('lists every problem, newest first by default', async () => {
    const app = makeApp();
    await seed(app);

    const items = data<ProblemListItem[]>(await request(app).get('/api/problems').expect(200));

    expect(items.map((i) => i.title).sort()).toEqual(['3Sum', 'Trapping Rain Water', 'Two Sum']);
    const twoSum = items.find((i) => i.title === 'Two Sum')!;
    expect(twoSum).toMatchObject({
      number: 1,
      difficulty: 'Easy',
      patterns: ['Hash Map'],
      language: 'JavaScript',
      status: 'Accepted',
      timeComplexity: 'O(1)',
      qualityScore: 100,
      reviewed: true,
      githubUrl: null,
    });
    expect(items.find((i) => i.title === 'Trapping Rain Water')).toMatchObject({
      reviewed: false,
      qualityScore: null,
    });
  });

  it('filters by difficulty, pattern, status, and language', async () => {
    const app = makeApp();
    await seed(app);
    const titles = async (query: Record<string, string>) =>
      data<ProblemListItem[]>(await request(app).get('/api/problems').query(query).expect(200))
        .map((i) => i.title)
        .sort();

    expect(await titles({ difficulty: 'Hard' })).toEqual(['Trapping Rain Water']);
    // Trapping Rain Water was never reviewed, so no analysis has recorded any patterns for it
    expect(await titles({ pattern: 'Two Pointers' })).toEqual(['3Sum']);
    expect(await titles({ status: 'Wrong Answer' })).toEqual(['Trapping Rain Water']);
    expect(await titles({ language: 'JavaScript' })).toHaveLength(3);
    expect(await titles({ language: 'Rust' })).toEqual([]);
  });

  it('searches by title, slug, and number', async () => {
    const app = makeApp();
    await seed(app);
    const titles = async (search: string) =>
      data<ProblemListItem[]>(
        await request(app).get('/api/problems').query({ search }).expect(200),
      ).map((i) => i.title);

    expect(await titles('rain')).toEqual(['Trapping Rain Water']);
    expect(await titles('3sum')).toEqual(['3Sum']);
    expect(await titles('42')).toEqual(['Trapping Rain Water']);
  });

  it('sorts by difficulty and by quality, with unreviewed problems last', async () => {
    const app = makeApp();
    await seed(app);

    const byDifficulty = data<ProblemListItem[]>(
      await request(app).get('/api/problems').query({ sortBy: 'difficulty', sortOrder: 'desc' }),
    );
    const byQuality = data<ProblemListItem[]>(
      await request(app).get('/api/problems').query({ sortBy: 'quality', sortOrder: 'asc' }),
    );

    expect(byDifficulty.map((i) => i.difficulty)).toEqual(['Hard', 'Medium', 'Easy']);
    expect(byQuality.map((i) => i.qualityScore)).toEqual([71, 100, null]);
  });

  it('combines filters, and ignores empty parameters', async () => {
    const app = makeApp();
    await seed(app);

    const items = data<ProblemListItem[]>(
      await request(app)
        .get('/api/problems')
        .query({ pattern: 'Two Pointers', difficulty: 'Medium', search: '' }),
    );

    expect(items.map((i) => i.title)).toEqual(['3Sum']);
  });

  it('rejects an invalid filter value with 400 VALIDATION_ERROR', async () => {
    const response = await request(makeApp())
      .get('/api/problems')
      .query({ difficulty: 'Impossible' });

    expect(response.status).toBe(400);
    expect((response.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an untracked pattern and an invalid sort key', async () => {
    const app = makeApp();
    await request(app).get('/api/problems').query({ pattern: 'Brute Force' }).expect(400);
    await request(app).get('/api/problems').query({ sortBy: 'colour' }).expect(400);
  });
});

describe('GET /api/problems/:id', () => {
  it('returns the full detail: problem, code, static analysis, AI review, quality', async () => {
    const app = makeApp();
    const { threeSum } = await seed(app);

    const detail = data<ProblemDetail>(
      await request(app).get(`/api/problems/${threeSum}`).expect(200),
    );

    expect(detail.problem).toMatchObject({
      number: 15,
      slug: '3sum',
      title: '3Sum',
      difficulty: 'Medium',
    });
    expect(detail.submission.code).toContain('var f = function');
    expect(detail.submission.status).toBe('Accepted');
    expect(detail.analysis?.timeComplexity.notation).toBeTruthy();
    expect(detail.review?.optimality.isOptimal).toBe(false);
    expect(detail.review?.improvements).toEqual(['Skip duplicates earlier.']);
    expect(detail.review?.learningPoints.length).toBeGreaterThan(0);
    expect(detail.review?.agreement).toBeDefined();
    expect(detail.qualityScore).toBe(71);
  });

  it('shows an unreviewed submission with null analysis and review', async () => {
    const app = makeApp();
    const { rain } = await seed(app);

    const detail = data<ProblemDetail>(await request(app).get(`/api/problems/${rain}`).expect(200));

    expect(detail.analysis).toBeNull();
    expect(detail.review).toBeNull();
    expect(detail.document).toBeNull();
  });

  it('returns 404 NOT_FOUND for an unknown or malformed id', async () => {
    const app = makeApp();
    await request(app).get('/api/problems/00000000-0000-4000-8000-000000000099').expect(404);
    const response = await request(app).get('/api/problems/not-a-uuid');
    expect(response.status).toBe(404);
    expect((response.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('recording from the document and publish endpoints', () => {
  it('records the generated document so the detail view can show it', async () => {
    const app = makeApp();
    const { twoSum } = await seed(app);

    await request(app).post(`/api/submissions/${twoSum}/document`).expect(200);

    const detail = data<ProblemDetail>(await request(app).get(`/api/problems/${twoSum}`));
    expect(detail.document).toEqual({
      filename: '001-two-sum.md',
      githubUrl: null,
      publishedAt: null,
    });
  });

  it('records the GitHub link when a problem is published, and lists it', async () => {
    const app = makeApp();
    const { twoSum } = await seed(app);

    const published = await request(app).post(`/api/submissions/${twoSum}/publish`).send({});
    expect(published.status).toBe(200);
    expect(data<{ documentUrl: string }>(published).documentUrl).toBe(
      'https://github.com/mock/mock/blob/main/problems/001-two-sum/README.md',
    );

    const detail = data<ProblemDetail>(await request(app).get(`/api/problems/${twoSum}`));
    const items = data<ProblemListItem[]>(await request(app).get('/api/problems'));
    expect(detail.document?.githubUrl).toBe(
      'https://github.com/mock/mock/blob/main/problems/001-two-sum/README.md',
    );
    expect(detail.document?.publishedAt).toBeTruthy();
    expect(items.find((i) => i.title === 'Two Sum')?.githubUrl).toBe(detail.document?.githubUrl);
  });

  it('still succeeds when recording fails (best-effort), logging instead of throwing', async () => {
    const app = makeApp();
    const { twoSum } = await seed(app);
    await db.exec('ALTER TABLE documents RENAME TO documents_broken');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await request(app).post(`/api/submissions/${twoSum}/document`);

      expect(response.status).toBe(200);
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining('failed to record document'),
        expect.any(String),
      );
    } finally {
      logged.mockRestore();
      await db.exec('ALTER TABLE documents_broken RENAME TO documents');
    }
  });

  it('replaces the stored review when a submission is reviewed again', async () => {
    const app = makeApp();
    const { twoSum } = await seed(app);

    await request(app).post(`/api/submissions/${twoSum}/review`).expect(200);

    const reviews = await db.query('SELECT id FROM reviews WHERE submission_id = $1', [twoSum]);
    expect(reviews).toHaveLength(1);
  });
});

describe('without a database', () => {
  it('answers 503 DATABASE_NOT_CONFIGURED for every dashboard endpoint', async () => {
    const app = makeApp({ withDatabase: false });

    for (const path of [
      '/api/dashboard/summary',
      '/api/dashboard/patterns',
      '/api/problems',
      '/api/problems/abc',
    ]) {
      const response = await request(app).get(path);
      expect(response.status, path).toBe(503);
      expect((response.body as { error: { code: string } }).error.code).toBe(
        'DATABASE_NOT_CONFIGURED',
      );
    }
  });

  it('still creates and reviews submissions in memory, exactly as before Phase 8', async () => {
    const app = makeApp({ withDatabase: false });

    const id = await submit(app, 'Two Sum');
    const review = await request(app).post(`/api/submissions/${id}/review`);

    expect(review.status).toBe(200);
  });
});
