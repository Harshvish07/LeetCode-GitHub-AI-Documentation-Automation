import type { ApiResponse } from '@codereviewai/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createFixedMockProvider } from '../ai/providers/mockProvider.js';
import { GitHubError } from '../github/errors.js';
import {
  createFailingGitHubClient,
  createInMemoryGitHubClient,
} from '../github/mockGitHubClient.js';
import type { PublishResult } from '../services/github-publish.service.js';

function submissionPayload(overrides: { code?: string } = {}) {
  return {
    problem: {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      description:
        'Given an array of integers, return indices of the two numbers that add up to target.',
    },
    submission: {
      language: 'JavaScript',
      code:
        overrides.code ??
        'var twoSum = function(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i++) { if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i]; seen.set(nums[i], i); } return []; };',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
    },
    metadata: {
      extractedAt: new Date().toISOString(),
      source: 'extension',
    },
  };
}

function validAiReviewJson() {
  return {
    problemSummary: 'Find two numbers that sum to a target.',
    userApproach: 'Single-pass hash map lookup.',
    patterns: ['Hash Map'],
    whyItWorks: 'Each complement is checked against previously seen numbers in O(1).',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['Single pass'],
    improvements: [],
    correctnessConcerns: [],
    edgeCases: [],
    optimality: { isOptimal: true, reasoning: 'Linear time is optimal for this problem.' },
    betterApproach: null,
    alternativeApproaches: [],
    learningPoints: ['Hash maps trade space for time.'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
  };
}

async function createStoredSubmission(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post('/api/submissions').send(submissionPayload());
  const body = response.body as ApiResponse<{ id: string }>;
  if (!body.success) throw new Error('failed to create test submission');
  return body.data.id;
}

const PROBLEM_PATH = 'problems/001-two-sum/README.md';

describe('POST /api/submissions/:id/publish', () => {
  it('publishes a new problem (default/create mode) and returns 200', async () => {
    const githubClient = createInMemoryGitHubClient();
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/publish`).send({});

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<PublishResult>;
    expect(body.success).toBe(true);
    if (body.success) {
      expect(body.data.status).toBe('created');
      expect(body.data.path).toBe(PROBLEM_PATH);
    }
  });

  it('returns 409 GITHUB_CONFLICT when the problem already exists and mode is create (avoid accidental overwrite)', async () => {
    const githubClient = createInMemoryGitHubClient({ [PROBLEM_PATH]: '# Two Sum\n\nold' });
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/publish`).send({});

    expect(response.status).toBe(409);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('GITHUB_CONFLICT');
  });

  it('returns 200 and updates when mode is explicitly "update" (intentional re-analysis)', async () => {
    const githubClient = createInMemoryGitHubClient({ [PROBLEM_PATH]: '# Two Sum\n\nold' });
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app)
      .post(`/api/submissions/${id}/publish`)
      .send({ mode: 'update' });

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<PublishResult>;
    if (body.success) expect(body.data.status).toBe('updated');
  });

  it('returns 404 GITHUB_NOT_FOUND when mode is "update" but nothing exists yet', async () => {
    const githubClient = createInMemoryGitHubClient();
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app)
      .post(`/api/submissions/${id}/publish`)
      .send({ mode: 'update' });

    expect(response.status).toBe(404);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('GITHUB_NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for an invalid mode value', async () => {
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient: createInMemoryGitHubClient(),
    });
    const id = await createStoredSubmission(app);

    const response = await request(app)
      .post(`/api/submissions/${id}/publish`)
      .send({ mode: 'delete-everything' });

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for an unknown submission id', async () => {
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient: createInMemoryGitHubClient(),
    });

    const response = await request(app).post('/api/submissions/does-not-exist/publish').send({});

    expect(response.status).toBe(404);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 502 GITHUB_AUTH_FAILED when GitHub authentication fails', async () => {
    const githubClient = createFailingGitHubClient(new GitHubError('AUTH_FAILED', 'bad token'));
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/publish`).send({});

    expect(response.status).toBe(502);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('GITHUB_AUTH_FAILED');
  });

  it('returns 502 GITHUB_API_ERROR for a generic GitHub API failure', async () => {
    const githubClient = createFailingGitHubClient(new GitHubError('API_ERROR', 'upstream 500'));
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/publish`).send({});

    expect(response.status).toBe(502);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('GITHUB_API_ERROR');
  });

  it('returns the same AI failure mapping as the review endpoint when the AI call fails', async () => {
    const githubClient = createInMemoryGitHubClient();
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider('Sure! Here is my review.'),
      githubClient,
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/publish`).send({});

    expect(response.status).toBe(502);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('AI_MALFORMED_RESPONSE');
  });
});
