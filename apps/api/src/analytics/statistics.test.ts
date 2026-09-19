import { describe, expect, it } from 'vitest';
import {
  buildPatternStats,
  buildSummary,
  toProblemListItem,
  type ProblemRecord,
} from './statistics.js';

const NOW = new Date('2026-09-19T12:00:00.000Z');

function record(overrides: Partial<ProblemRecord> = {}): ProblemRecord {
  return {
    submissionId: 's1',
    problemId: 'p1',
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    language: 'JavaScript',
    status: 'Accepted',
    submittedAt: '2026-09-19T10:00:00.000Z',
    staticPatterns: ['Hash Map'],
    aiPatterns: ['Hash Map'],
    staticTimeComplexity: 'O(n)',
    aiTimeComplexity: 'O(n)',
    qualityScore: 100,
    isOptimal: true,
    correctnessConcernsCount: 0,
    reviewed: true,
    githubUrl: null,
    ...overrides,
  };
}

const optimalHash = record();
const slowTwoPointer = record({
  submissionId: 's2',
  problemId: 'p2',
  number: 15,
  slug: '3sum',
  title: '3Sum',
  difficulty: 'Medium',
  staticPatterns: [],
  aiPatterns: ['Two Pointers', 'Sorting'],
  aiTimeComplexity: 'O(n^2)',
  qualityScore: 70,
  isOptimal: false,
  submittedAt: '2026-09-18T10:00:00.000Z',
});
const failedHard = record({
  submissionId: 's3',
  problemId: 'p3',
  number: 42,
  slug: 'trapping-rain-water',
  title: 'Trapping Rain Water',
  difficulty: 'Hard',
  status: 'Wrong Answer',
  staticPatterns: ['Two Pointers'],
  aiPatterns: [],
  qualityScore: null,
  isOptimal: null,
  correctnessConcernsCount: null,
  reviewed: false,
  aiTimeComplexity: null,
  staticTimeComplexity: 'O(n)',
  submittedAt: '2026-09-15T10:00:00.000Z',
});
const records = [optimalHash, slowTwoPointer, failedHard];

describe('buildSummary', () => {
  const summary = buildSummary(
    records,
    records.map((r) => r.submittedAt),
    NOW,
  );

  it('counts total problems and accepted solutions', () => {
    expect(summary.totalProblems).toBe(3);
    expect(summary.acceptedSolutions).toBe(2);
  });

  it('counts optimal, needing-improvement, and unreviewed separately', () => {
    expect(summary.optimalSolutions).toBe(1);
    expect(summary.needingImprovement).toBe(1);
    expect(summary.unreviewed).toBe(1);
  });

  it('builds the difficulty distribution', () => {
    expect(summary.difficultyDistribution).toEqual({ Easy: 1, Medium: 1, Hard: 1, Unknown: 0 });
  });

  it('counts an unknown difficulty under "Unknown"', () => {
    const result = buildSummary([record({ difficulty: null })], [], NOW);
    expect(result.difficultyDistribution.Unknown).toBe(1);
  });

  it('counts distinct patterns practiced from accepted solutions only', () => {
    // Hash Map (s1), Two Pointers + Sorting (s2); s3's Two Pointers is not accepted
    expect(summary.patternsPracticed).toBe(3);
  });

  it('computes the current streak from activity dates', () => {
    expect(summary.currentStreak).toBe(2); // Sep 18 and 19
    expect(summary.longestStreak).toBe(2);
  });

  it('lists recent problems newest first, capped at five', () => {
    expect(summary.recentProblems.map((p) => p.slug)).toEqual([
      'two-sum',
      '3sum',
      'trapping-rain-water',
    ]);
    const many = Array.from({ length: 8 }, (_, i) =>
      record({
        submissionId: `x${i}`,
        problemId: `px${i}`,
        submittedAt: `2026-09-0${i + 1}T00:00:00Z`,
      }),
    );
    expect(buildSummary(many, [], NOW).recentProblems).toHaveLength(5);
  });

  it('is all zeros for no records', () => {
    const empty = buildSummary([], [], NOW);
    expect(empty.totalProblems).toBe(0);
    expect(empty.currentStreak).toBe(0);
    expect(empty.recentProblems).toEqual([]);
  });

  it('treats a reviewed optimal solution with a correctness concern as needing improvement', () => {
    const result = buildSummary([record({ correctnessConcernsCount: 1 })], [], NOW);
    expect(result.needingImprovement).toBe(1);
    expect(result.optimalSolutions).toBe(1);
  });
});

describe('buildPatternStats', () => {
  const stats = buildPatternStats(records);
  const byPattern = (name: string) => stats.find((s) => s.pattern === name)!;

  it('returns an entry for every tracked pattern, including unpracticed ones', () => {
    expect(stats).toHaveLength(16);
    expect(byPattern('Heap').solved).toBe(0);
    expect(byPattern('Heap').averageQuality).toBeNull();
  });

  it('counts solved (accepted) solutions per pattern', () => {
    expect(byPattern('Hash Map').solved).toBe(1);
    expect(byPattern('Two Pointers').solved).toBe(1); // the failed Wrong Answer one is excluded
    expect(byPattern('Sorting').solved).toBe(1);
  });

  it('averages quality over reviewed solutions', () => {
    expect(byPattern('Hash Map').averageQuality).toBe(100);
    expect(byPattern('Two Pointers').averageQuality).toBe(70);
    const mixed = buildPatternStats([
      record({ qualityScore: 90 }),
      record({ submissionId: 's9', problemId: 'p9', qualityScore: 81 }),
    ]);
    expect(mixed.find((s) => s.pattern === 'Hash Map')!.averageQuality).toBe(85.5);
  });

  it('counts improvement opportunities and lists problems to revisit', () => {
    expect(byPattern('Hash Map').improvementOpportunities).toBe(0);
    expect(byPattern('Two Pointers').improvementOpportunities).toBe(1);
    expect(byPattern('Two Pointers').revisit).toEqual([{ submissionId: 's2', title: '3Sum' }]);
  });

  it('lists the lowest-quality problems first and caps the revisit list at three', () => {
    const many = [10, 50, 30, 20, 40].map((score, i) =>
      record({
        submissionId: `r${i}`,
        problemId: `pr${i}`,
        title: `Problem ${score}`,
        qualityScore: score,
        isOptimal: false,
      }),
    );
    const revisit = buildPatternStats(many).find((s) => s.pattern === 'Hash Map')!.revisit;
    expect(revisit.map((r) => r.title)).toEqual(['Problem 10', 'Problem 20', 'Problem 30']);
  });
});

describe('toProblemListItem', () => {
  it('prefers the AI time complexity, falling back to the static estimate', () => {
    expect(toProblemListItem(optimalHash).timeComplexity).toBe('O(n)');
    expect(toProblemListItem(failedHard).timeComplexity).toBe('O(n)');
    expect(
      toProblemListItem(record({ aiTimeComplexity: null, staticTimeComplexity: null }))
        .timeComplexity,
    ).toBeNull();
  });

  it('merges static and AI patterns into normalized tracked patterns', () => {
    expect(toProblemListItem(slowTwoPointer).patterns).toEqual(['Two Pointers', 'Sorting']);
  });

  it('carries quality, review state, and github link through', () => {
    const item = toProblemListItem(record({ githubUrl: 'https://github.com/o/r/blob/main/x.md' }));
    expect(item.qualityScore).toBe(100);
    expect(item.reviewed).toBe(true);
    expect(item.githubUrl).toBe('https://github.com/o/r/blob/main/x.md');
  });
});
