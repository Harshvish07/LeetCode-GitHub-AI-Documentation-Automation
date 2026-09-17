import type { ApiResponse } from '@codereviewai/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { AiReviewError } from '../ai/errors.js';
import {
  createFailingMockProvider,
  createFixedMockProvider,
} from '../ai/providers/mockProvider.js';
import type { GeneratedDocument } from '../document/types.js';

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

async function createStoredSubmission(
  app: ReturnType<typeof createApp>,
  code?: string,
): Promise<string> {
  const response = await request(app).post('/api/submissions').send(submissionPayload({ code }));
  const body = response.body as ApiResponse<{ id: string }>;
  if (!body.success) throw new Error('failed to create test submission');
  return body.data.id;
}

describe('POST /api/submissions/:id/document', () => {
  it('returns 200 with a filename and complete Markdown content', async () => {
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/document`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<GeneratedDocument>;
    expect(body.success).toBe(true);
    if (body.success) {
      expect(body.data.filename).toBe('001-two-sum.md');
      expect(body.data.content).toContain('# LeetCode Problem: Two Sum');
      expect(body.data.content).toContain('YOUR SOLUTION');
      expect(body.data.content).toContain('var twoSum = function(nums, target)');
      expect(body.data.content).toContain('## Complexity Analysis');
      expect(body.data.content).toContain('Single-pass hash map lookup.');
    }
  });

  it('returns 404 for an unknown submission id', async () => {
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(validAiReviewJson())),
    });

    const response = await request(app).post('/api/submissions/does-not-exist/document');

    expect(response.status).toBe(404);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('NOT_FOUND');
  });

  it('maps an AI provider failure to the same error codes as the review endpoint', async () => {
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFailingMockProvider(new AiReviewError('TIMEOUT', 'took too long')),
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/document`);

    expect(response.status).toBe(504);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('AI_TIMEOUT');
  });

  it('returns 502 AI_INVALID_RESPONSE when the AI JSON fails schema validation', async () => {
    const invalidPayload = { ...validAiReviewJson() } as Record<string, unknown>;
    delete invalidPayload.learningPoints;
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(JSON.stringify(invalidPayload)),
    });
    const id = await createStoredSubmission(app);

    const response = await request(app).post(`/api/submissions/${id}/document`);

    expect(response.status).toBe(502);
    const body = response.body as ApiResponse<never>;
    if (!body.success) expect(body.error.code).toBe('AI_INVALID_RESPONSE');
  });

  it('surfaces a complexity disagreement inside the generated document', async () => {
    const nestedLoopCode =
      'var f = function(nums) { let count = 0; for (let i = 0; i < nums.length; i++) { for (let j = 0; j < nums.length; j++) { count++; } } return count; };';
    const app = createApp({
      corsOrigin: 'http://localhost:5173',
      aiProvider: createFixedMockProvider(
        JSON.stringify({ ...validAiReviewJson(), complexity: { time: 'O(n)', space: 'O(1)' } }),
      ),
    });
    const id = await createStoredSubmission(app, nestedLoopCode);

    const response = await request(app).post(`/api/submissions/${id}/document`);

    expect(response.status).toBe(200);
    const body = response.body as ApiResponse<GeneratedDocument>;
    if (body.success) {
      expect(body.data.content).toContain('Disagreement detected');
    } else {
      throw new Error('expected a successful response');
    }
  });
});
