import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { StoredSubmission } from '@codereviewai/shared';
import { randomUUID } from 'node:crypto';
import type { SolutionReview } from '../ai/schemas/solutionReview.schema.js';
import type { CombinedSolutionReview } from '../ai/types.js';

/**
 * Shared builders for tests that need realistic stored submissions and
 * combined reviews (persistence, dashboard API). Test-only — the whole
 * `src/testing/` directory is excluded from the production build.
 */
function confidence(level: 'low' | 'medium' | 'high' = 'high') {
  return { level, score: 0.8, reason: 'test' };
}

export function storedSubmission(
  overrides: {
    id?: string;
    slug?: string;
    number?: number | null;
    title?: string;
    difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
    code?: string;
    status?: StoredSubmission['submission']['status'];
    language?: StoredSubmission['submission']['language'];
    receivedAt?: string;
  } = {},
): StoredSubmission {
  const slug = overrides.slug ?? 'two-sum';
  return {
    id: overrides.id ?? randomUUID(),
    problem: {
      url: `https://leetcode.com/problems/${slug}/`,
      slug,
      number: overrides.number === undefined ? 1 : overrides.number,
      title: overrides.title ?? 'Two Sum',
      difficulty: overrides.difficulty === undefined ? 'Easy' : overrides.difficulty,
      description: 'Return indices of the two numbers that add up to target.',
    },
    submission: {
      language: overrides.language === undefined ? 'JavaScript' : overrides.language,
      code: overrides.code ?? 'var twoSum = function(nums, target) { return []; };',
      status: overrides.status === undefined ? 'Accepted' : overrides.status,
      runtime: '52 ms',
      memory: '42.1 MB',
    },
    metadata: {
      extractedAt: '2026-09-19T09:00:00.000Z',
      source: 'extension',
      receivedAt: overrides.receivedAt ?? '2026-09-19T10:00:00.000Z',
    },
  };
}

export function deterministicAnalysis(overrides: Partial<SolutionAnalysis> = {}): SolutionAnalysis {
  return {
    detectedLanguage: 'JavaScript',
    detectedPatterns: [{ pattern: 'Hash Map', confidence: confidence(), evidence: ['new Map('] }],
    estimatedTimeComplexity: { notation: 'O(n)', confidence: confidence(), reasoning: ['loop'] },
    estimatedSpaceComplexity: { notation: 'O(n)', confidence: confidence(), reasoning: ['map'] },
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
    edgeCaseObservations: [{ concern: 'Empty input', detail: 'No guard found.', severity: 'info' }],
    confidence: confidence(),
    ...overrides,
  };
}

export function aiReview(overrides: Partial<SolutionReview> = {}): SolutionReview {
  return {
    problemSummary: 'Find two numbers that sum to a target.',
    userApproach: 'Single-pass hash map lookup.',
    patterns: ['Hash Map'],
    whyItWorks: 'Each complement is checked in O(1).',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['Single pass'],
    improvements: [],
    correctnessConcerns: [],
    edgeCases: ['Empty array'],
    optimality: { isOptimal: true, reasoning: 'Linear time is optimal.' },
    betterApproach: null,
    alternativeApproaches: ['Sort + two pointers'],
    learningPoints: ['Hash maps trade space for time.'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
    ...overrides,
  };
}

export function combinedReview(
  submissionId: string,
  overrides: { ai?: Partial<SolutionReview>; deterministic?: Partial<SolutionAnalysis> } = {},
): CombinedSolutionReview {
  const deterministic = deterministicAnalysis(overrides.deterministic);
  const ai = aiReview(overrides.ai);
  return {
    submissionId,
    deterministic,
    ai,
    agreement: {
      time: {
        matches: deterministic.estimatedTimeComplexity.notation === ai.complexity.time,
        deterministic: deterministic.estimatedTimeComplexity.notation,
        ai: ai.complexity.time,
      },
      space: {
        matches: deterministic.estimatedSpaceComplexity.notation === ai.complexity.space,
        deterministic: deterministic.estimatedSpaceComplexity.notation,
        ai: ai.complexity.space,
      },
      patternsAgreedOn: ['Hash Map'],
      patternsOnlyInDeterministic: [],
      patternsOnlyInAi: [],
      hasDisagreement: false,
    },
    generatedAt: '2026-09-19T10:05:00.000Z',
  };
}
