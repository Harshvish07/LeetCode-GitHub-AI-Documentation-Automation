import { describe, expect, it } from 'vitest';
import type { ProblemListItem } from '../types/dashboard.js';
import { applyProblemQuery, filterProblems, sortProblems } from './problemQuery.js';

function item(overrides: Partial<ProblemListItem> = {}): ProblemListItem {
  return {
    submissionId: 's1',
    problemId: 'p1',
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    patterns: ['Hash Map'],
    language: 'JavaScript',
    status: 'Accepted',
    timeComplexity: 'O(n)',
    qualityScore: 90,
    isOptimal: true,
    reviewed: true,
    submittedAt: '2026-09-10T10:00:00.000Z',
    githubUrl: null,
    ...overrides,
  };
}

const twoSum = item();
const addTwo = item({
  submissionId: 's2',
  problemId: 'p2',
  number: 2,
  slug: 'add-two-numbers',
  title: 'Add Two Numbers',
  difficulty: 'Medium',
  patterns: ['Tree'],
  language: 'Python',
  status: 'Wrong Answer',
  timeComplexity: 'O(n^2)',
  qualityScore: 40,
  isOptimal: false,
  submittedAt: '2026-09-12T10:00:00.000Z',
});
const median = item({
  submissionId: 's3',
  problemId: 'p3',
  number: 4,
  slug: 'median-of-two-sorted-arrays',
  title: 'Median of Two Sorted Arrays',
  difficulty: 'Hard',
  patterns: ['Binary Search', 'Sorting'],
  timeComplexity: 'O(log n)',
  qualityScore: null,
  isOptimal: null,
  reviewed: false,
  submittedAt: '2026-09-11T10:00:00.000Z',
});
const all = [twoSum, addTwo, median];

describe('filterProblems', () => {
  it('returns everything for an empty query', () => {
    expect(filterProblems(all, {})).toHaveLength(3);
  });

  it('filters by difficulty', () => {
    expect(filterProblems(all, { difficulty: 'Hard' }).map((i) => i.slug)).toEqual([
      'median-of-two-sorted-arrays',
    ]);
  });

  it('filters by tracked pattern (a problem can have several)', () => {
    expect(filterProblems(all, { pattern: 'Sorting' })).toEqual([median]);
    expect(filterProblems(all, { pattern: 'Binary Search' })).toEqual([median]);
  });

  it('filters by status and language', () => {
    expect(filterProblems(all, { status: 'Wrong Answer' })).toEqual([addTwo]);
    expect(filterProblems(all, { language: 'Python' })).toEqual([addTwo]);
  });

  it('searches title case-insensitively', () => {
    expect(filterProblems(all, { search: 'MEDIAN' })).toEqual([median]);
  });

  it('searches slug, number, and pattern names', () => {
    expect(filterProblems(all, { search: 'add-two' })).toEqual([addTwo]);
    expect(filterProblems(all, { search: '4' })).toEqual([median]);
    expect(filterProblems(all, { search: 'hash map' })).toEqual([twoSum]);
  });

  it('ignores a whitespace-only search', () => {
    expect(filterProblems(all, { search: '   ' })).toHaveLength(3);
  });

  it('combines filters with AND semantics', () => {
    expect(filterProblems(all, { difficulty: 'Medium', language: 'JavaScript' })).toEqual([]);
    expect(filterProblems(all, { difficulty: 'Medium', language: 'Python' })).toEqual([addTwo]);
  });

  it('does not mutate its input', () => {
    const copy = [...all];
    filterProblems(all, { difficulty: 'Easy' });
    expect(all).toEqual(copy);
  });
});

describe('sortProblems', () => {
  it('defaults to newest first', () => {
    expect(sortProblems(all).map((i) => i.slug)).toEqual([
      'add-two-numbers',
      'median-of-two-sorted-arrays',
      'two-sum',
    ]);
  });

  it('sorts by difficulty Easy < Medium < Hard, and reverses', () => {
    expect(sortProblems(all, 'difficulty', 'asc').map((i) => i.difficulty)).toEqual([
      'Easy',
      'Medium',
      'Hard',
    ]);
    expect(sortProblems(all, 'difficulty', 'desc').map((i) => i.difficulty)).toEqual([
      'Hard',
      'Medium',
      'Easy',
    ]);
  });

  it('sorts by title alphabetically', () => {
    expect(sortProblems(all, 'title').map((i) => i.title)).toEqual([
      'Add Two Numbers',
      'Median of Two Sorted Arrays',
      'Two Sum',
    ]);
  });

  it('sorts by problem number', () => {
    expect(sortProblems(all, 'number', 'desc').map((i) => i.number)).toEqual([4, 2, 1]);
  });

  it('sorts complexity by growth rate, not alphabetically', () => {
    expect(sortProblems(all, 'complexity', 'asc').map((i) => i.timeComplexity)).toEqual([
      'O(log n)',
      'O(n)',
      'O(n^2)',
    ]);
  });

  it('always puts rows with a missing value last, in either direction', () => {
    expect(sortProblems(all, 'quality', 'asc').map((i) => i.qualityScore)).toEqual([40, 90, null]);
    expect(sortProblems(all, 'quality', 'desc').map((i) => i.qualityScore)).toEqual([90, 40, null]);
  });

  it('does not mutate its input', () => {
    const copy = [...all];
    sortProblems(all, 'title');
    expect(all).toEqual(copy);
  });
});

describe('applyProblemQuery', () => {
  it('filters then sorts', () => {
    const result = applyProblemQuery(all, {
      search: 'two',
      sortBy: 'difficulty',
      sortOrder: 'desc',
    });
    expect(result.map((i) => i.slug)).toEqual([
      'median-of-two-sorted-arrays',
      'add-two-numbers',
      'two-sum',
    ]);
  });
});
