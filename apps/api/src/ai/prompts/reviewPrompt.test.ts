import type { SolutionAnalysis } from '@codereviewai/analysis';
import { describe, expect, it } from 'vitest';
import { buildReviewSystemPrompt, buildReviewUserPrompt } from './reviewPrompt.js';
import type { ReviewPromptInput } from './reviewPrompt.js';

function confidence(level: 'low' | 'medium' | 'high' = 'high') {
  return { level, score: 0.8, reason: 'test' };
}

function baseInput(overrides: Partial<ReviewPromptInput> = {}): ReviewPromptInput {
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
      codeQualityObservations: [
        { category: 'mutation', severity: 'warning', message: 'mutates nums' },
      ],
      edgeCaseObservations: [
        { concern: 'Empty input', detail: 'no guard found', severity: 'info' },
      ],
      confidence: confidence(),
    } satisfies SolutionAnalysis,
    ...overrides,
  };
}

describe('buildReviewSystemPrompt', () => {
  it('instructs the model to respond with JSON only and lists every schema field', () => {
    const prompt = buildReviewSystemPrompt();

    expect(prompt).toContain('ONLY a single JSON object');
    for (const field of [
      'problemSummary',
      'userApproach',
      'patterns',
      'whyItWorks',
      'complexity',
      'strengths',
      'improvements',
      'correctnessConcerns',
      'edgeCases',
      'optimality',
      'betterApproach',
      'alternativeApproaches',
      'learningPoints',
      'relatedPatterns',
      'confidence',
    ]) {
      expect(prompt).toContain(field);
    }
  });

  it('tells the model the deterministic analysis can be wrong', () => {
    const prompt = buildReviewSystemPrompt();
    expect(prompt.toLowerCase()).toContain('can be wrong');
  });
});

describe('buildReviewUserPrompt', () => {
  it('includes the problem title, difficulty, and description', () => {
    const prompt = buildReviewUserPrompt(baseInput());
    expect(prompt).toContain('Two Sum');
    expect(prompt).toContain('Easy');
    expect(prompt).toContain('return indices of the two numbers');
  });

  it('includes the submitted code and language', () => {
    const prompt = buildReviewUserPrompt(baseInput());
    expect(prompt).toContain('JavaScript');
    expect(prompt).toContain('var twoSum = function(nums, target)');
  });

  it('includes the deterministic analysis findings', () => {
    const prompt = buildReviewUserPrompt(baseInput());
    expect(prompt).toContain('Hash Map');
    expect(prompt).toContain('O(n)');
    expect(prompt).toContain('mutates nums');
    expect(prompt).toContain('no guard found');
  });

  it('never includes submission metadata (runtime/memory/status are the only submission fields sent, no ids or timestamps)', () => {
    const prompt = buildReviewUserPrompt(baseInput());
    // The prompt builder's input type has no id/receivedAt/extractedAt/source
    // fields at all (ReviewPromptInput only accepts problem/submission/analysis),
    // so this is really a compile-time guarantee — this test asserts the
    // rendered text doesn't leak anything metadata-shaped either.
    expect(prompt).not.toMatch(/receivedAt|extractedAt|"source"|submissionId/i);
  });

  it('renders "Unavailable" for null problem/submission fields instead of inventing a value', () => {
    const input = baseInput();
    input.problem = { ...input.problem, difficulty: null, description: null };
    input.submission = { ...input.submission, language: null };

    const prompt = buildReviewUserPrompt(input);

    expect(prompt).toContain('Difficulty: Unavailable');
    expect(prompt).toContain('Language: Unavailable');
  });

  it('truncates an excessively long problem description', () => {
    const input = baseInput();
    input.problem = { ...input.problem, description: 'x'.repeat(5000) };

    const prompt = buildReviewUserPrompt(input);

    expect(prompt).toContain('(truncated)');
    expect(prompt.length).toBeLessThan(5000);
  });

  it('truncates an excessively long submitted code block', () => {
    const input = baseInput();
    input.submission = { ...input.submission, code: 'x'.repeat(20000) };

    const prompt = buildReviewUserPrompt(input);

    expect(prompt).toContain('(truncated)');
  });

  it('renders "(none detected)" when no patterns were found', () => {
    const input = baseInput();
    input.deterministicAnalysis = { ...input.deterministicAnalysis, detectedPatterns: [] };

    const prompt = buildReviewUserPrompt(input);

    expect(prompt).toContain('(none detected)');
  });
});
