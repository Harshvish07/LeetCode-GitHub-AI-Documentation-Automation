import { describe, expect, it } from 'vitest';
import { solutionReviewSchema } from './solutionReview.schema.js';
import type { SolutionReview } from './solutionReview.schema.js';

function validPayload(): SolutionReview {
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

describe('solutionReviewSchema', () => {
  it('accepts a fully valid payload', () => {
    expect(solutionReviewSchema.safeParse(validPayload()).success).toBe(true);
  });

  it('accepts a payload with a populated betterApproach', () => {
    const payload = validPayload();
    payload.betterApproach = {
      description: 'Sort then two-pointer scan.',
      pseudocode: '1. Sort the array.\n2. Walk pointers inward until the sum matches.',
      code: 'function twoSumSorted(nums, target) { /* ... */ }',
      complexity: { time: 'O(n log n)', space: 'O(1)' },
      whyBetter: 'Uses constant extra space instead of a hash map.',
    };
    expect(solutionReviewSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts every empty-array field being genuinely empty', () => {
    const payload = validPayload();
    payload.strengths = [];
    payload.relatedPatterns = [];
    expect(solutionReviewSchema.safeParse(payload).success).toBe(true);
  });

  for (const field of [
    'problemSummary',
    'userApproach',
    'whyItWorks',
    'complexity',
    'optimality',
    'confidence',
  ]) {
    it(`rejects a payload missing required field "${field}"`, () => {
      const payload = validPayload() as Record<string, unknown>;
      delete payload[field];
      expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
    });
  }

  it('rejects a payload missing learningPoints entirely (required, non-empty)', () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.learningPoints;
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an empty learningPoints array (must have at least one)', () => {
    const payload = validPayload();
    payload.learningPoints = [];
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects patterns given as a string instead of an array', () => {
    const payload = { ...validPayload(), patterns: 'Hash Map' };
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an unknown confidence value', () => {
    const payload = { ...validPayload(), confidence: 'extremely high' };
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects complexity missing the space field', () => {
    const payload = validPayload();
    payload.complexity = { time: 'O(n)' } as unknown as { time: string; space: string };
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a betterApproach missing whyBetter', () => {
    const payload = validPayload();
    payload.betterApproach = {
      description: 'desc',
      pseudocode: 'step 1\nstep 2',
      code: 'function f() {}',
      complexity: { time: 'O(n)', space: 'O(1)' },
    } as unknown as SolutionReview['betterApproach'];
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a betterApproach missing pseudocode', () => {
    const payload = validPayload();
    payload.betterApproach = {
      description: 'desc',
      code: 'function f() {}',
      complexity: { time: 'O(n)', space: 'O(1)' },
      whyBetter: 'because',
    } as unknown as SolutionReview['betterApproach'];
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a betterApproach missing code', () => {
    const payload = validPayload();
    payload.betterApproach = {
      description: 'desc',
      pseudocode: 'step 1\nstep 2',
      complexity: { time: 'O(n)', space: 'O(1)' },
      whyBetter: 'because',
    } as unknown as SolutionReview['betterApproach'];
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a completely malformed payload (wrong shape entirely)', () => {
    expect(solutionReviewSchema.safeParse(['not', 'an', 'object']).success).toBe(false);
    expect(solutionReviewSchema.safeParse('a plain string').success).toBe(false);
    expect(solutionReviewSchema.safeParse(null).success).toBe(false);
  });

  it('rejects empty-string values for required string fields', () => {
    const payload = validPayload();
    payload.problemSummary = '';
    expect(solutionReviewSchema.safeParse(payload).success).toBe(false);
  });
});
