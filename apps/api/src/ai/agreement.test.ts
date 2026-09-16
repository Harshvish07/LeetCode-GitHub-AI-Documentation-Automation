import type { SolutionAnalysis } from '@codereviewai/analysis';
import { describe, expect, it } from 'vitest';
import { compareAnalyses } from './agreement.js';
import type { SolutionReview } from './schemas/solutionReview.schema.js';

function confidence(level: 'low' | 'medium' | 'high' = 'high') {
  return { level, score: 0.8, reason: 'test' };
}

function deterministicAnalysis(overrides: Partial<SolutionAnalysis> = {}): SolutionAnalysis {
  return {
    detectedLanguage: 'JavaScript',
    detectedPatterns: [{ pattern: 'Hash Map', confidence: confidence(), evidence: ['new Map('] }],
    estimatedTimeComplexity: { notation: 'O(n)', confidence: confidence(), reasoning: [] },
    estimatedSpaceComplexity: { notation: 'O(n)', confidence: confidence(), reasoning: [] },
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
    ...overrides,
  };
}

function aiReview(overrides: Partial<SolutionReview> = {}): SolutionReview {
  return {
    problemSummary: 'summary',
    userApproach: 'hash map lookup',
    patterns: ['Hash Map'],
    whyItWorks: 'because',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['clear'],
    improvements: [],
    correctnessConcerns: [],
    edgeCases: [],
    optimality: { isOptimal: true, reasoning: 'optimal' },
    betterApproach: null,
    alternativeApproaches: [],
    learningPoints: ['hash maps trade space for time'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
    ...overrides,
  };
}

describe('compareAnalyses', () => {
  it('reports agreement when both complexity estimates and patterns match', () => {
    const agreement = compareAnalyses(deterministicAnalysis(), aiReview());

    expect(agreement.time.matches).toBe(true);
    expect(agreement.space.matches).toBe(true);
    expect(agreement.patternsAgreedOn).toEqual(['Hash Map']);
    expect(agreement.patternsOnlyInDeterministic).toEqual([]);
    expect(agreement.patternsOnlyInAi).toEqual([]);
    expect(agreement.hasDisagreement).toBe(false);
  });

  it('treats "O(n log n)" and "O(nlogn)" as the same notation (whitespace-insensitive)', () => {
    const agreement = compareAnalyses(
      deterministicAnalysis({
        estimatedTimeComplexity: {
          notation: 'O(n log n)',
          confidence: confidence(),
          reasoning: [],
        },
      }),
      aiReview({ complexity: { time: 'O(nlogn)', space: 'O(n)' } }),
    );

    expect(agreement.time.matches).toBe(true);
  });

  it('exposes a time-complexity disagreement rather than hiding it (the task’s O(n) vs O(n^2) example)', () => {
    const agreement = compareAnalyses(
      deterministicAnalysis({
        estimatedTimeComplexity: {
          notation: 'O(n^2)',
          confidence: confidence('low'),
          reasoning: [],
        },
      }),
      aiReview({ complexity: { time: 'O(n)', space: 'O(n)' } }),
    );

    expect(agreement.time.matches).toBe(false);
    expect(agreement.time.deterministic).toBe('O(n^2)');
    expect(agreement.time.ai).toBe('O(n)');
    expect(agreement.hasDisagreement).toBe(true);
  });

  it('exposes a space-complexity disagreement independently of time', () => {
    const agreement = compareAnalyses(
      deterministicAnalysis(),
      aiReview({ complexity: { time: 'O(n)', space: 'O(1)' } }),
    );

    expect(agreement.time.matches).toBe(true);
    expect(agreement.space.matches).toBe(false);
    expect(agreement.hasDisagreement).toBe(true);
  });

  it('reports a pattern the AI found that static analysis missed', () => {
    const agreement = compareAnalyses(
      deterministicAnalysis({ detectedPatterns: [] }),
      aiReview({ patterns: ['Greedy'] }),
    );

    expect(agreement.patternsOnlyInAi).toEqual(['Greedy']);
    expect(agreement.patternsOnlyInDeterministic).toEqual([]);
    expect(agreement.hasDisagreement).toBe(true);
  });

  it('reports a pattern static analysis found that the AI did not mention', () => {
    const agreement = compareAnalyses(deterministicAnalysis(), aiReview({ patterns: [] }));

    expect(agreement.patternsOnlyInDeterministic).toEqual(['Hash Map']);
    expect(agreement.hasDisagreement).toBe(true);
  });

  it('matches pattern names case-insensitively', () => {
    const agreement = compareAnalyses(
      deterministicAnalysis(),
      aiReview({ patterns: ['hash map'] }),
    );

    expect(agreement.patternsAgreedOn).toEqual(['Hash Map']);
    expect(agreement.hasDisagreement).toBe(false);
  });

  it('flags disagreement when the deterministic estimate is itself "Unknown"', () => {
    const agreement = compareAnalyses(
      deterministicAnalysis({
        estimatedTimeComplexity: {
          notation: 'Unknown (mixed loop + recursion)',
          confidence: confidence('low'),
          reasoning: [],
        },
      }),
      aiReview({ complexity: { time: 'O(n)', space: 'O(n)' } }),
    );

    expect(agreement.time.matches).toBe(false);
    expect(agreement.hasDisagreement).toBe(true);
  });
});
