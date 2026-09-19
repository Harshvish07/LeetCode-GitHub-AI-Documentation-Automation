import { describe, expect, it } from 'vitest';
import { attemptRecord } from '../testing/attemptFixtures.js';
import type { AttemptRecord } from './attempts.js';
import { buildLearningProfile } from './learningProfile.js';
import { buildRecommendations } from './recommendations.js';

let problemCounter = 0;
/** Builds the attempts of one distinct problem, oldest first. */
function problem(...attempts: Array<Partial<AttemptRecord>>): AttemptRecord[] {
  problemCounter += 1;
  return attempts.map((overrides) =>
    attemptRecord({
      problemId: `p-${problemCounter}`,
      slug: `problem-${problemCounter}`,
      title: `Problem ${problemCounter}`,
      ...overrides,
    }),
  );
}

const quadratic = {
  reviewed: true,
  aiTimeComplexity: 'O(n^2)',
  staticTimeComplexity: 'O(n^2)',
  isOptimal: false,
  qualityScore: 60,
};
const linearHash = {
  reviewed: true,
  aiPatterns: ['Hash Map'],
  aiTimeComplexity: 'O(n)',
  staticTimeComplexity: 'O(n)',
};

describe('buildLearningProfile — no data', () => {
  it('reports an empty history without inventing anything', () => {
    const profile = buildLearningProfile([]);
    expect(profile).toMatchObject({
      problems: 0,
      attempts: 0,
      reviewedAttempts: 0,
      sufficientData: false,
      insights: [],
    });
    expect(profile.notes[0]).toBe('No submissions have been recorded yet.');
    expect(profile.patterns.every((p) => p.level === 'untouched')).toBe(true);
    expect(profile.patterns).toHaveLength(16);
  });

  it('draws no recurring conclusion from a single attempt', () => {
    const profile = buildLearningProfile(problem({ status: 'Time Limit Exceeded' }));
    expect(profile.insights).toEqual([]);
    expect(profile.sufficientData).toBe(false);
    expect(profile.notes.join(' ')).toContain('Only 1 problem(s) recorded');
  });

  it('always says that explanation quality is not measured', () => {
    const profile = buildLearningProfile([]);
    expect(profile.notes.join(' ')).toContain('not measured');
  });
});

describe('buildLearningProfile — status weaknesses', () => {
  it('flags repeated Time Limit Exceeded with counts and examples', () => {
    const attempts = [
      ...problem({ status: 'Time Limit Exceeded' }, { status: 'Accepted' }),
      ...problem({ status: 'Time Limit Exceeded' }),
      ...problem({ status: 'Accepted' }),
    ];
    const insight = buildLearningProfile(attempts).insights.find(
      (i) => i.id === 'repeated-time-limit-exceeded',
    );
    expect(insight).toBeDefined();
    expect(insight!.kind).toBe('weakness');
    expect(insight!.evidence).toMatchObject({ count: 2, total: 4 });
    expect(insight!.evidence.examples).toHaveLength(2);
  });

  it('does not flag a status that happened only once', () => {
    const attempts = [...problem({ status: 'Wrong Answer' }), ...problem({ status: 'Accepted' })];
    expect(
      buildLearningProfile(attempts).insights.some((i) => i.id === 'repeated-wrong-answer'),
    ).toBe(false);
  });

  it('flags problems retried without ever being Accepted', () => {
    const attempts = [
      ...problem({ status: 'Wrong Answer' }, { status: 'Wrong Answer' }),
      ...problem({ status: 'Time Limit Exceeded' }, { status: 'Wrong Answer' }),
      ...problem({ status: 'Accepted' }),
    ];
    const insight = buildLearningProfile(attempts).insights.find(
      (i) => i.id === 'unresolved-problems',
    );
    expect(insight?.evidence).toMatchObject({ count: 2, total: 3 });
  });
});

describe('buildLearningProfile — reviewed weaknesses', () => {
  it('finds slower-first solutions and names the pattern that made them faster', () => {
    const attempts = [
      ...problem({ ...quadratic, status: 'Time Limit Exceeded' }, { ...linearHash }),
      ...problem({ ...quadratic, status: 'Time Limit Exceeded' }, { ...linearHash }),
      ...problem({ ...linearHash }),
    ];
    const insight = buildLearningProfile(attempts).insights.find(
      (i) => i.id === 'slower-first-solutions',
    );
    expect(insight).toBeDefined();
    expect(insight!.evidence).toMatchObject({ count: 2, total: 3 });
    expect(insight!.description).toContain('Hash Map appears in the faster approach for 2 of them');
  });

  it('uses the review better-approach complexity when there was no later attempt', () => {
    const slowWithBetter = {
      ...quadratic,
      betterApproachTimeComplexity: 'O(n)',
      betterApproachDescription: 'Use a hash map to look up complements.',
    };
    const attempts = [...problem(slowWithBetter), ...problem(slowWithBetter)];
    const insight = buildLearningProfile(attempts).insights.find(
      (i) => i.id === 'slower-first-solutions',
    );
    expect(insight?.evidence.count).toBe(2);
    expect(insight?.description).toContain('Hash Map');
  });

  it('does not flag slower-first when no evidence of a faster alternative exists', () => {
    const attempts = [...problem({ ...quadratic }), ...problem({ ...quadratic })];
    expect(
      buildLearningProfile(attempts).insights.some((i) => i.id === 'slower-first-solutions'),
    ).toBe(false);
  });

  it('flags edge-case concerns only when the review text names an edge input', () => {
    const edge = { reviewed: true, correctnessConcerns: ['Fails on an empty array.'] };
    const other = { reviewed: true, correctnessConcerns: ['Off by one in the loop.'] };
    const flagged = buildLearningProfile([...problem(edge), ...problem(edge), ...problem(other)]);
    expect(flagged.insights.find((i) => i.id === 'missed-edge-cases')?.evidence).toMatchObject({
      count: 2,
      total: 3,
    });

    const notFlagged = buildLearningProfile([
      ...problem(edge),
      ...problem(other),
      ...problem(other),
    ]);
    expect(notFlagged.insights.some((i) => i.id === 'missed-edge-cases')).toBe(false);
  });

  it('flags Accepted-but-not-optimal solutions', () => {
    const notOptimal = { ...quadratic, status: 'Accepted' };
    const attempts = [
      ...problem(notOptimal),
      ...problem(notOptimal),
      ...problem({ reviewed: true }),
    ];
    expect(
      buildLearningProfile(attempts).insights.find((i) => i.id === 'accepted-not-optimal')
        ?.evidence,
    ).toMatchObject({ count: 2, total: 3 });
  });

  it('notes attempts that have no review', () => {
    const profile = buildLearningProfile([...problem({ status: 'Accepted' }, { reviewed: true })]);
    expect(profile.reviewedAttempts).toBe(1);
    expect(profile.notes.join(' ')).toContain('1 of 2 attempts have no AI review');
  });
});

describe('buildLearningProfile — patterns and strengths', () => {
  const graph = (status: string) => ({ reviewed: true, aiPatterns: ['Graph Traversal'], status });
  const map = (overrides: Partial<AttemptRecord> = {}) => ({
    reviewed: true,
    aiPatterns: ['Hash Map'],
    status: 'Accepted',
    ...overrides,
  });

  it('marks a pattern weak when few of its problems are Accepted, strong when all are clean', () => {
    const attempts = [
      ...problem(graph('Wrong Answer')),
      ...problem(graph('Wrong Answer')),
      ...problem(graph('Accepted')),
      ...problem(map()),
      ...problem(map()),
    ];
    const profile = buildLearningProfile(attempts);
    expect(profile.patterns.find((p) => p.pattern === 'Graph')).toMatchObject({
      problems: 3,
      accepted: 1,
      level: 'weak',
    });
    expect(profile.patterns.find((p) => p.pattern === 'Hash Map')).toMatchObject({
      problems: 2,
      accepted: 2,
      level: 'strong',
      averageQuality: 100,
    });
    expect(profile.insights.find((i) => i.id === 'weak-pattern-graph')?.kind).toBe('weakness');
    expect(profile.insights.find((i) => i.id === 'strong-pattern-hash-map')?.kind).toBe('strength');
  });

  it('keeps a one-problem pattern at "developing" rather than judging it', () => {
    const profile = buildLearningProfile(problem(graph('Wrong Answer')));
    expect(profile.patterns.find((p) => p.pattern === 'Graph')?.level).toBe('developing');
  });

  it('reports recovery from failed first attempts as a strength', () => {
    const attempts = [
      ...problem({ status: 'Wrong Answer' }, { status: 'Accepted' }),
      ...problem({ status: 'Time Limit Exceeded' }, { status: 'Accepted' }),
      ...problem({ status: 'Wrong Answer' }, { status: 'Wrong Answer' }),
    ];
    const insight = buildLearningProfile(attempts).insights.find(
      (i) => i.id === 'recovers-from-failures',
    );
    expect(insight).toMatchObject({ kind: 'strength', evidence: { count: 2, total: 3 } });
  });
});

describe('buildRecommendations', () => {
  it('says there is nothing to base recommendations on with no data', () => {
    const result = buildRecommendations([]);
    expect(result).toEqual({
      practiceMore: [],
      review: [],
      sufficientData: false,
      summary: 'No submissions recorded yet, so there is nothing to base recommendations on.',
    });
  });

  it('does not pad a tiny history with untouched patterns', () => {
    const result = buildRecommendations(problem({ status: 'Accepted' }));
    expect(result.practiceMore).toEqual([]);
    expect(result.review).toEqual([]);
    expect(result.sufficientData).toBe(false);
    expect(result.summary).toContain('need more history');
  });

  it('recommends reviewing a weak pattern, with evidence', () => {
    const graph = (status: string) => ({ reviewed: true, aiPatterns: ['Graph'], status });
    const attempts = [
      ...problem(graph('Wrong Answer')),
      ...problem(graph('Wrong Answer')),
      ...problem(graph('Accepted')),
    ];
    const result = buildRecommendations(attempts);
    expect(result.review).toHaveLength(1);
    expect(result.review[0]).toMatchObject({
      pattern: 'Graph',
      action: 'review',
      evidence: { count: 2, total: 3 },
    });
    expect(result.review[0]!.reason).toContain('1 of 3 Graph problems Accepted');
    expect(result.summary).toContain('Review: Graph.');
  });

  it('recommends practicing a pattern the reviews suggested but the user has not used', () => {
    const suggestion = {
      reviewed: true,
      aiPatterns: ['Hash Map'],
      betterApproachDescription: 'A sliding window keeps the running count in O(n).',
    };
    const attempts = [
      ...problem(suggestion),
      ...problem({ reviewed: true }),
      ...problem({ reviewed: true }),
    ];
    const result = buildRecommendations(attempts);
    const sliding = result.practiceMore.find((r) => r.pattern === 'Sliding Window');
    expect(sliding).toBeDefined();
    expect(sliding!.evidence.count).toBe(1);
    expect(result.summary).toContain('Practice more:');
  });

  it('recommends reviewing a pattern suggested on two or more problems', () => {
    const suggestion = {
      reviewed: true,
      aiPatterns: ['Two Pointers'],
      status: 'Accepted',
      betterApproachDescription: 'Use a hash map to avoid the nested loop.',
    };
    const attempts = [
      ...problem({ ...suggestion, aiPatterns: ['Hash Map'] }),
      ...problem({ ...suggestion, aiPatterns: ['Hash Map'] }),
    ];
    // Hash Map is already used in the user's own patterns, so it is not a suggestion at all.
    expect(buildRecommendations(attempts).review).toEqual([]);

    const withGap = [
      ...problem(suggestion),
      ...problem(suggestion),
      ...problem(suggestion),
      ...problem({ reviewed: true, aiPatterns: ['Hash Map'], status: 'Accepted' }),
    ];
    const result = buildRecommendations(withGap);
    expect(result.review.map((r) => r.pattern)).toContain('Hash Map');
    expect(result.review.find((r) => r.pattern === 'Hash Map')!.evidence).toMatchObject({
      count: 3,
      total: 4,
    });
  });

  it('adds never-practiced patterns once there are enough problems', () => {
    const attempts = [
      ...problem({ reviewed: true, aiPatterns: ['Hash Map'] }),
      ...problem({ reviewed: true, aiPatterns: ['Hash Map'] }),
      ...problem({ reviewed: true, aiPatterns: ['Hash Map'] }),
    ];
    const result = buildRecommendations(attempts);
    expect(result.sufficientData).toBe(true);
    expect(result.practiceMore.length).toBeGreaterThan(0);
    expect(result.practiceMore.every((r) => r.pattern !== 'Hash Map')).toBe(true);
    expect(result.practiceMore[0]!.evidence).toEqual({ count: 0, total: 3, examples: [] });
    expect(result.practiceMore.length).toBeLessThanOrEqual(5);
  });
});
