import type { SolutionAnalysis } from '@codereviewai/analysis';
import { describe, expect, it, vi } from 'vitest';
import { AiReviewService } from './ai-review.service.js';
import { AiReviewError } from './errors.js';
import type { ReviewPromptInput } from './prompts/reviewPrompt.js';
import {
  createFailingMockProvider,
  createFixedMockProvider,
  createMockProvider,
} from './providers/mockProvider.js';

function confidence(level: 'low' | 'medium' | 'high' = 'high') {
  return { level, score: 0.8, reason: 'test' };
}

function reviewInput(): ReviewPromptInput {
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
      code: 'var twoSum = function(nums, target) { return []; };',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
    },
    deterministicAnalysis: {
      detectedLanguage: 'JavaScript',
      detectedPatterns: [{ pattern: 'Hash Map', confidence: confidence(), evidence: ['new Map('] }],
      estimatedTimeComplexity: {
        notation: 'O(n)',
        confidence: confidence(),
        reasoning: ['single loop'],
      },
      estimatedSpaceComplexity: {
        notation: 'O(n)',
        confidence: confidence(),
        reasoning: ['hash map'],
      },
      algorithmCharacteristics: {
        usesRecursion: false,
        usesIteration: true,
        maxLoopNestingDepth: 1,
        usesSorting: false,
        usesHashing: true,
        usesExtraLinearStructure: true,
      },
      possibleIssues: [],
      codeQualityObservations: [],
      edgeCaseObservations: [],
      confidence: confidence(),
    } satisfies SolutionAnalysis,
  };
}

function validReviewJson() {
  return {
    problemSummary: 'Find two numbers that sum to a target.',
    userApproach: 'Single-pass hash map lookup.',
    patterns: ['Hash Map'],
    whyItWorks: 'Each complement is checked against previously seen numbers in O(1).',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['Single pass', 'Clear naming'],
    improvements: [],
    correctnessConcerns: [],
    edgeCases: ['Empty array'],
    optimality: { isOptimal: true, reasoning: 'Linear time is optimal for this problem.' },
    betterApproach: null,
    alternativeApproaches: ['Sort + two pointers, O(n log n)'],
    learningPoints: ['Hash maps trade space for time to avoid nested loops.'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
  };
}

describe('AiReviewService.generateReview', () => {
  it('returns a schema-validated review for a well-formed provider response', async () => {
    const provider = createFixedMockProvider(JSON.stringify(validReviewJson()));
    const service = new AiReviewService(provider);

    const review = await service.generateReview(reviewInput());

    expect(review.userApproach).toBe('Single-pass hash map lookup.');
    expect(review.patterns).toEqual(['Hash Map']);
    expect(review.confidence).toBe('high');
  });

  it('parses a response wrapped in a ```json markdown fence', async () => {
    const provider = createFixedMockProvider(
      '```json\n' + JSON.stringify(validReviewJson()) + '\n```',
    );
    const service = new AiReviewService(provider);

    const review = await service.generateReview(reviewInput());

    expect(review.userApproach).toBe('Single-pass hash map lookup.');
  });

  it('passes the problem, code, and deterministic analysis into the provider prompt', async () => {
    const generate = vi.fn().mockResolvedValue({ text: JSON.stringify(validReviewJson()) });
    const provider = createMockProvider(generate);
    const service = new AiReviewService(provider);

    await service.generateReview(reviewInput());

    expect(generate).toHaveBeenCalledTimes(1);
    const request = generate.mock.calls[0]?.[0] as { systemPrompt: string; userPrompt: string };
    expect(request.userPrompt).toContain('Two Sum');
    expect(request.userPrompt).toContain('var twoSum');
    expect(request.userPrompt).toContain('Hash Map');
    expect(request.systemPrompt).toContain('JSON');
  });

  it('rejects with MALFORMED_RESPONSE when the provider text is not JSON', async () => {
    const provider = createFixedMockProvider('Sure, here is my review: it looks good!');
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({
      code: 'MALFORMED_RESPONSE',
    });
  });

  it('rejects with SCHEMA_VALIDATION_FAILED when a required field is missing', async () => {
    const payload = validReviewJson() as Record<string, unknown>;
    delete payload.learningPoints;
    const provider = createFixedMockProvider(JSON.stringify(payload));
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({
      code: 'SCHEMA_VALIDATION_FAILED',
    });
  });

  it('rejects with SCHEMA_VALIDATION_FAILED when a field has the wrong type', async () => {
    const payload = { ...validReviewJson(), patterns: 'Hash Map' }; // should be an array
    const provider = createFixedMockProvider(JSON.stringify(payload));
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({
      code: 'SCHEMA_VALIDATION_FAILED',
    });
  });

  it('rejects with SCHEMA_VALIDATION_FAILED when confidence is not one of the allowed values', async () => {
    const payload = { ...validReviewJson(), confidence: 'very high' };
    const provider = createFixedMockProvider(JSON.stringify(payload));
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({
      code: 'SCHEMA_VALIDATION_FAILED',
    });
  });

  it('propagates a provider-raised AiReviewError unchanged (e.g. rate limiting)', async () => {
    const provider = createFailingMockProvider(new AiReviewError('RATE_LIMITED', 'slow down'));
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('wraps a non-AiReviewError thrown by the provider into PROVIDER_ERROR', async () => {
    const provider = createFailingMockProvider(new Error('boom'));
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('rejects with TIMEOUT when the provider never resolves within the configured timeout', async () => {
    const provider = createMockProvider(() => new Promise(() => {}));
    const service = new AiReviewService(provider, { maxOutputTokens: 1000, timeoutMs: 20 });

    await expect(service.generateReview(reviewInput())).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('every rejection is an instance of AiReviewError', async () => {
    const provider = createFixedMockProvider('not json');
    const service = new AiReviewService(provider);

    await expect(service.generateReview(reviewInput())).rejects.toBeInstanceOf(AiReviewError);
  });
});
