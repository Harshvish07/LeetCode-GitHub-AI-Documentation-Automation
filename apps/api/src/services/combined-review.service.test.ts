import type { StoredSubmission } from '@codereviewai/shared';
import { describe, expect, it } from 'vitest';
import { AiReviewService } from '../ai/ai-review.service.js';
import { createFixedMockProvider } from '../ai/providers/mockProvider.js';
import { buildCombinedReview, MissingCodeError } from './combined-review.service.js';

function storedSubmission(
  overrides: Partial<StoredSubmission['submission']> = {},
): StoredSubmission {
  return {
    id: 'sub-1',
    problem: {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      description: 'Return indices of the two numbers that add up to target.',
    },
    submission: {
      language: 'JavaScript',
      code: 'var twoSum = function(nums, target) { return []; };',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
      ...overrides,
    },
    metadata: {
      extractedAt: new Date().toISOString(),
      source: 'extension',
      receivedAt: new Date().toISOString(),
    },
  };
}

function validReviewJson() {
  return {
    problemSummary: 'Find two numbers that sum to a target.',
    userApproach: 'Single-pass hash map lookup.',
    patterns: ['Hash Map'],
    whyItWorks: 'Each complement is checked in O(1).',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['Single pass'],
    improvements: [],
    correctnessConcerns: [],
    edgeCases: [],
    optimality: { isOptimal: true, reasoning: 'Linear time is optimal.' },
    betterApproach: null,
    alternativeApproaches: [],
    learningPoints: ['Hash maps trade space for time.'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
  };
}

describe('buildCombinedReview', () => {
  it('combines a fresh deterministic analysis with the AI review and their agreement', async () => {
    const reviewService = new AiReviewService(
      createFixedMockProvider(JSON.stringify(validReviewJson())),
    );

    const combined = await buildCombinedReview(storedSubmission(), reviewService);

    expect(combined.submissionId).toBe('sub-1');
    expect(combined.ai.userApproach).toBe('Single-pass hash map lookup.');
    expect(combined.deterministic.detectedLanguage).toBe('JavaScript');
    expect(combined.agreement).toBeDefined();
    expect(combined.generatedAt).toBeTruthy();
  });

  it('rejects with MissingCodeError when the stored submission has no code', async () => {
    const reviewService = new AiReviewService(
      createFixedMockProvider(JSON.stringify(validReviewJson())),
    );

    await expect(
      buildCombinedReview(storedSubmission({ code: null }), reviewService),
    ).rejects.toBeInstanceOf(MissingCodeError);
  });

  it('propagates an AI provider failure unchanged', async () => {
    const reviewService = new AiReviewService(createFixedMockProvider('not json'));

    await expect(buildCombinedReview(storedSubmission(), reviewService)).rejects.toMatchObject({
      code: 'MALFORMED_RESPONSE',
    });
  });
});
