import { randomUUID } from 'node:crypto';
import type { AttemptRecord } from '../analytics/attempts.js';

let attemptCounter = 0;

/**
 * An `AttemptRecord` for the pure improvement-engine tests. Unreviewed by
 * default; pass `reviewed: true` to get review data. `minutes` offsets the
 * timestamp so attempts sort in call order. Test-only (excluded from the build).
 */
export function attemptRecord(
  overrides: Partial<AttemptRecord> & { minutes?: number } = {},
): AttemptRecord {
  attemptCounter += 1;
  const { minutes = attemptCounter, ...rest } = overrides;
  const reviewed = rest.reviewed ?? false;
  return {
    submissionId: randomUUID(),
    problemId: 'problem-1',
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    language: 'JavaScript',
    code: 'function f() {\n  return 1;\n}',
    status: 'Accepted',
    runtime: '52 ms',
    memory: '42 MB',
    submittedAt: new Date(Date.UTC(2026, 8, 1, 0, minutes)).toISOString(),
    reviewed,
    staticPatterns: [],
    aiPatterns: [],
    staticTimeComplexity: reviewed ? 'O(n)' : null,
    aiTimeComplexity: reviewed ? 'O(n)' : null,
    staticSpaceComplexity: reviewed ? 'O(n)' : null,
    aiSpaceComplexity: reviewed ? 'O(n)' : null,
    qualityScore: reviewed ? 100 : null,
    isOptimal: reviewed ? true : null,
    correctnessConcernsCount: reviewed ? 0 : null,
    improvementsCount: reviewed ? 0 : null,
    correctnessConcerns: [],
    approach: reviewed ? 'An approach.' : null,
    betterApproachDescription: null,
    betterApproachTimeComplexity: null,
    ...rest,
  };
}
