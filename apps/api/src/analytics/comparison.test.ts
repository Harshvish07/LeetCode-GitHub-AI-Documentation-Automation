import { describe, expect, it } from 'vitest';
import { attemptRecord } from '../testing/attemptFixtures.js';
import { buildProblemHistory, compareAttempts } from './comparison.js';

const brute = {
  reviewed: true,
  aiPatterns: ['Brute Force'],
  aiTimeComplexity: 'O(n^2)',
  staticTimeComplexity: 'O(n^2)',
  qualityScore: 50,
  isOptimal: false,
  correctnessConcernsCount: 1,
};

const hashed = {
  reviewed: true,
  aiPatterns: ['Hash Map'],
  aiTimeComplexity: 'O(n)',
  staticTimeComplexity: 'O(n)',
  qualityScore: 95,
  isOptimal: true,
  correctnessConcernsCount: 0,
};

describe('compareAttempts', () => {
  it('detects a fixed status, complexity improvement, and pattern change', () => {
    const a = attemptRecord({ ...brute, status: 'Time Limit Exceeded', code: 'for\nfor' });
    const b = attemptRecord({ ...hashed, status: 'Accepted', code: 'map\nfor' });
    const result = compareAttempts(a, 1, b, 2);

    expect(result.status).toEqual({
      from: 'Time Limit Exceeded',
      to: 'Accepted',
      change: 'fixed',
    });
    expect(result.timeComplexity.change).toBe('improved');
    expect(result.patterns.added).toEqual(['Hash Map']);
    expect(result.algorithmChanged).toBe(true);
    expect(result.bugFixed).toBe(true);
    expect(result.codeQualityImproved).toBe(true);
    expect(result.qualityScore.delta).toBe(45);
    expect(result.correctnessConcerns.delta).toBe(-1);
    expect(result.code).toMatchObject({ linesAdded: 1, linesRemoved: 1, identical: false });
    expect(result.highlights).toContain('Time complexity improved from O(n^2) to O(n).');
    expect(result.highlights).toContain('Started using: Hash Map.');
  });

  it('detects a regression', () => {
    const result = compareAttempts(
      attemptRecord({ ...hashed }),
      1,
      attemptRecord({ ...brute, status: 'Wrong Answer' }),
      2,
    );
    expect(result.status.change).toBe('regressed');
    expect(result.timeComplexity.change).toBe('regressed');
    expect(result.codeQualityImproved).toBe(false);
    expect(result.bugFixed).toBe(false);
  });

  it('reports a non-Accepted to non-Accepted move as "changed" without claiming a bug fix', () => {
    const result = compareAttempts(
      attemptRecord({ status: 'Wrong Answer' }),
      1,
      attemptRecord({ status: 'Time Limit Exceeded' }),
      2,
    );
    expect(result.status.change).toBe('changed');
    expect(result.bugFixed).toBe(false);
  });

  it('treats a dropped correctness concern as a bug fix even when both are non-Accepted', () => {
    const result = compareAttempts(
      attemptRecord({ ...brute, correctnessConcernsCount: 2, status: 'Wrong Answer' }),
      1,
      attemptRecord({ ...brute, correctnessConcernsCount: 0, status: 'Wrong Answer' }),
      2,
    );
    expect(result.bugFixed).toBe(true);
  });

  it('makes no review-based claims when an attempt is unreviewed', () => {
    const result = compareAttempts(
      attemptRecord({ status: 'Wrong Answer' }),
      1,
      attemptRecord({ ...hashed }),
      2,
    );
    expect(result.reviewedBoth).toBe(false);
    expect(result.algorithmChanged).toBeNull();
    expect(result.codeQualityImproved).toBeNull();
    expect(result.timeComplexity.change).toBe('unknown');
    expect(result.patterns).toEqual({ added: [], removed: [] });
    expect(result.highlights.join(' ')).toContain('no review');
  });

  it('reports unchanged code and a language change', () => {
    const result = compareAttempts(
      attemptRecord({ code: 'x', language: 'Python3' }),
      1,
      attemptRecord({ code: 'x', language: 'JavaScript' }),
      2,
    );
    expect(result.code.identical).toBe(true);
    expect(result.code.languageChanged).toBe(true);
    expect(result.highlights).toContain('The code did not change (ignoring whitespace).');
  });
});

describe('buildProblemHistory', () => {
  it('describes the failed → improved → accepted journey', () => {
    const history = buildProblemHistory([
      attemptRecord({ ...brute, status: 'Wrong Answer' }),
      attemptRecord({ ...brute, status: 'Time Limit Exceeded' }),
      attemptRecord({ ...hashed, status: 'Accepted' }),
    ]);

    expect(history.attempts.map((a) => a.attemptNumber)).toEqual([1, 2, 3]);
    expect(history.comparisons).toHaveLength(2);
    expect(history.overview).toMatchObject({
      attemptCount: 3,
      firstStatus: 'Wrong Answer',
      finalStatus: 'Accepted',
      finalAccepted: true,
      firstAcceptedAttempt: 3,
      complexityJourney: ['O(n^2)', 'O(n)'],
      outcome: 'improved',
    });
    expect(history.overview.explanation).toContain(
      'Status path: Wrong Answer (attempt 1) → Time Limit Exceeded (attempt 2) → Accepted (attempt 3).',
    );
    expect(history.overview.explanation).toContain('Time complexity went O(n^2) → O(n).');
    expect(history.overview.explanation).toContain('Adopted: Hash Map.');
  });

  it('handles a single attempt', () => {
    const history = buildProblemHistory([attemptRecord({ ...hashed })]);
    expect(history.comparisons).toEqual([]);
    expect(history.overview.outcome).toBe('single-attempt');
    expect(history.overview.explanation[0]).toContain('Only one attempt');
  });

  it('flags a regression outcome', () => {
    const history = buildProblemHistory([
      attemptRecord({ ...hashed }),
      attemptRecord({ ...brute, status: 'Time Limit Exceeded' }),
    ]);
    expect(history.overview.outcome).toBe('regressed');
  });

  it('reports no change when nothing moved', () => {
    const history = buildProblemHistory([
      attemptRecord({ status: 'Wrong Answer' }),
      attemptRecord({ status: 'Wrong Answer' }),
    ]);
    expect(history.overview.outcome).toBe('no-change');
    expect(history.overview.explanation.join(' ')).toContain(
      'Fewer than two attempts have a review',
    );
  });

  it('rejects an empty list', () => {
    expect(() => buildProblemHistory([])).toThrow();
  });
});
