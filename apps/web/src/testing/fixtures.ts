import type {
  AttemptSummary,
  DashboardSummary,
  LearningProfile,
  PatternStat,
  ProblemDetail,
  ProblemHistory,
  ProblemListItem,
  Recommendations,
} from '@codereviewai/shared';
import { TRACKED_PATTERNS } from '@codereviewai/shared';
import { vi } from 'vitest';

export function problemItem(overrides: Partial<ProblemListItem> = {}): ProblemListItem {
  return {
    submissionId: 'sub-1',
    problemId: 'prob-1',
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    patterns: ['Hash Map'],
    language: 'JavaScript',
    status: 'Accepted',
    timeComplexity: 'O(n)',
    qualityScore: 95,
    isOptimal: true,
    reviewed: true,
    submittedAt: '2026-09-19T10:00:00.000Z',
    githubUrl: null,
    ...overrides,
  };
}

export function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalProblems: 12,
    acceptedSolutions: 9,
    needingImprovement: 4,
    optimalSolutions: 5,
    unreviewed: 3,
    currentStreak: 4,
    longestStreak: 7,
    patternsPracticed: 6,
    difficultyDistribution: { Easy: 6, Medium: 4, Hard: 2, Unknown: 0 },
    recentProblems: [
      problemItem(),
      problemItem({
        submissionId: 'sub-2',
        number: 15,
        title: '3Sum',
        difficulty: 'Medium',
        qualityScore: 58,
        status: 'Wrong Answer',
      }),
    ],
    ...overrides,
  };
}

export function patternStats(): PatternStat[] {
  return TRACKED_PATTERNS.map((pattern) => ({
    pattern,
    solved: 0,
    averageQuality: null,
    improvementOpportunities: 0,
    revisit: [],
  })).map((stat) =>
    stat.pattern === 'Hash Map'
      ? {
          ...stat,
          solved: 5,
          averageQuality: 91.5,
          improvementOpportunities: 2,
          revisit: [{ submissionId: 'sub-2', title: '3Sum' }],
        }
      : stat,
  );
}

export function problemDetail(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    submissionId: 'sub-1',
    problem: {
      number: 1,
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      url: 'https://leetcode.com/problems/two-sum/',
      description: 'Return indices of the two numbers that add up to target.',
    },
    submission: {
      language: 'JavaScript',
      code: 'const seen = new Map<string, number>();\nif (a < b && c > d) return "<b>bold</b>";',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
      submittedAt: '2026-09-19T10:00:00.000Z',
    },
    analysis: {
      patterns: [{ pattern: 'Hash Map', confidence: 'high' }],
      timeComplexity: { notation: 'O(n)', confidence: 'medium' },
      spaceComplexity: { notation: 'O(n)', confidence: 'medium' },
      confidence: 'medium',
      possibleIssues: [],
      codeQualityObservations: [{ message: 'Consider clearer names.', severity: 'info' }],
      edgeCaseObservations: [
        { concern: 'Empty input', detail: 'No guard found.', severity: 'info' },
      ],
    },
    review: {
      problemSummary: 'Find two numbers that sum to a target.',
      userApproach: 'Single-pass hash map.',
      patterns: ['Hash Map'],
      whyItWorks: 'Each complement is looked up in O(1).',
      complexity: { time: 'O(n)', space: 'O(n)' },
      strengths: ['Single pass'],
      improvements: ['Validate input'],
      correctnessConcerns: [],
      edgeCases: ['Empty array'],
      optimality: { isOptimal: true, reasoning: 'Linear time is optimal.' },
      betterApproach: null,
      alternativeApproaches: ['Sort and two pointers'],
      learningPoints: ['Trade space for time.'],
      relatedPatterns: ['Two Pointers'],
      confidence: 'high',
      agreement: {
        time: { matches: true, deterministic: 'O(n)', ai: 'O(n)' },
        space: { matches: true, deterministic: 'O(n)', ai: 'O(n)' },
        patternsAgreedOn: ['Hash Map'],
        patternsOnlyInDeterministic: [],
        patternsOnlyInAi: [],
        hasDisagreement: false,
      },
    },
    qualityScore: 91,
    document: {
      filename: '001-two-sum.md',
      githubUrl: 'https://github.com/me/journal/blob/main/problems/001-two-sum/README.md',
      publishedAt: '2026-09-19T11:00:00.000Z',
    },
    ...overrides,
  };
}

type Handler = (url: string) => unknown | Promise<unknown>;

/**
 * Stubs global `fetch` with URL-prefix routes returning API envelopes.
 * A route value may be a function of the full URL. Unmatched URLs return a
 * 404-style failure envelope so a missing route is loud, not silent.
 */
export function mockApi(routes: Record<string, unknown | Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => url.startsWith(prefix));

    if (!key) {
      return {
        json: async () => ({
          success: false,
          error: { message: `No mock for ${url}`, code: 'NOT_FOUND' },
        }),
      };
    }
    const route = routes[key];
    const value = typeof route === 'function' ? await (route as Handler)(url) : route;
    return { json: async () => value };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const ok = <T>(data: T) => ({ success: true as const, data });
export const fail = (message: string, code = 'ERROR') => ({
  success: false as const,
  error: { message, code },
});

export const HEALTH = ok({ status: 'ok', uptimeSeconds: 12, timestamp: 'now', version: '0.1.0' });

export function attemptSummary(overrides: Partial<AttemptSummary> = {}): AttemptSummary {
  return {
    attemptNumber: 1,
    submissionId: 'sub-1',
    submittedAt: '2026-09-17T10:00:00.000Z',
    language: 'JavaScript',
    status: 'Wrong Answer',
    runtime: null,
    memory: null,
    code: 'for (;;) { if (a < b) return "<i>x</i>"; }',
    reviewed: true,
    timeComplexity: 'O(n^2)',
    spaceComplexity: 'O(1)',
    patterns: [],
    qualityScore: 50,
    isOptimal: false,
    correctnessConcernsCount: 1,
    improvementsCount: 1,
    approach: 'Check every pair.',
    ...overrides,
  };
}

export function problemHistory(overrides: Partial<ProblemHistory> = {}): ProblemHistory {
  return {
    problem: { number: 1, slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' },
    attempts: [
      attemptSummary(),
      attemptSummary({
        attemptNumber: 2,
        submissionId: 'sub-2',
        status: 'Accepted',
        runtime: '52 ms',
        memory: '42 MB',
        timeComplexity: 'O(n)',
        patterns: ['Hash Map'],
        qualityScore: 95,
        approach: 'Hash map lookup.',
        code: 'const m = new Map();',
      }),
    ],
    comparisons: [
      {
        fromAttempt: 1,
        toAttempt: 2,
        status: { from: 'Wrong Answer', to: 'Accepted', change: 'fixed' },
        timeComplexity: { from: 'O(n^2)', to: 'O(n)', change: 'improved' },
        spaceComplexity: { from: 'O(1)', to: 'O(1)', change: 'same' },
        patterns: { added: ['Hash Map'], removed: [] },
        algorithmChanged: true,
        qualityScore: { from: 50, to: 95, delta: 45 },
        correctnessConcerns: { from: 1, to: 0, delta: -1 },
        bugFixed: true,
        codeQualityImproved: true,
        code: { linesAdded: 1, linesRemoved: 1, languageChanged: false, identical: false },
        reviewedBoth: true,
        highlights: [
          'Status improved from Wrong Answer to Accepted.',
          'Time complexity improved from O(n^2) to O(n).',
        ],
      },
    ],
    overview: {
      attemptCount: 2,
      firstStatus: 'Wrong Answer',
      finalStatus: 'Accepted',
      finalAccepted: true,
      firstAcceptedAttempt: 2,
      complexityJourney: ['O(n^2)', 'O(n)'],
      outcome: 'improved',
      explanation: ['Reached Accepted on attempt 2 after 1 unsuccessful attempt(s).'],
    },
    ...overrides,
  };
}

export function learningProfile(overrides: Partial<LearningProfile> = {}): LearningProfile {
  return {
    problems: 4,
    attempts: 7,
    reviewedAttempts: 6,
    sufficientData: true,
    insights: [
      {
        id: 'repeated-time-limit-exceeded',
        kind: 'weakness',
        title: 'Repeated Time Limit Exceeded',
        description: 'Time Limit Exceeded was the verdict on 3 of 7 attempts.',
        evidence: {
          count: 3,
          total: 7,
          examples: [{ submissionId: 'sub-9', title: 'Trap Water' }],
        },
      },
      {
        id: 'strong-pattern-hash-map',
        kind: 'strength',
        title: 'Solid at Hash Map',
        description: 'Hash Map: all 2 problems Accepted.',
        evidence: { count: 2, total: 2, examples: [] },
      },
    ],
    patterns: TRACKED_PATTERNS.map((pattern) => ({
      pattern,
      problems: pattern === 'Hash Map' ? 2 : 0,
      accepted: pattern === 'Hash Map' ? 2 : 0,
      averageQuality: pattern === 'Hash Map' ? 92 : null,
      needingImprovement: 0,
      level: pattern === 'Hash Map' ? ('strong' as const) : ('untouched' as const),
    })),
    notes: ['Explanation quality is not measured.'],
    ...overrides,
  };
}

export function recommendations(overrides: Partial<Recommendations> = {}): Recommendations {
  return {
    practiceMore: [
      {
        pattern: 'Sliding Window',
        action: 'practice',
        reason: 'No Sliding Window problem has been recorded among 4 problems.',
        evidence: { count: 0, total: 4, examples: [] },
      },
    ],
    review: [
      {
        pattern: 'Graph',
        action: 'review',
        reason: '1 of 3 Graph problems Accepted; 2 need improvement.',
        evidence: { count: 2, total: 3, examples: [] },
      },
    ],
    sufficientData: true,
    summary: 'Practice more: Sliding Window. Review: Graph.',
    ...overrides,
  };
}
