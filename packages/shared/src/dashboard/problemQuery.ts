import type { ProblemListItem, ProblemListQuery, ProblemSortKey } from '../types/dashboard.js';
import type { LeetCodeDifficulty } from '../types/leetcode.js';

const DIFFICULTY_RANK: Record<LeetCodeDifficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

/**
 * Pure search/filter/sort over the problem list — shared so `apps/api`
 * (which applies the query server-side) and any client can never disagree
 * about what "search" or "sort by difficulty" means. Never mutates its input.
 */
export function filterProblems(
  items: ProblemListItem[],
  query: ProblemListQuery,
): ProblemListItem[] {
  const search = query.search?.trim().toLowerCase() ?? '';

  return items.filter((item) => {
    if (query.difficulty && item.difficulty !== query.difficulty) return false;
    if (query.pattern && !item.patterns.includes(query.pattern)) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.language && item.language !== query.language) return false;
    if (search.length > 0 && !matchesSearch(item, search)) return false;
    return true;
  });
}

function matchesSearch(item: ProblemListItem, search: string): boolean {
  const haystack = [
    item.title,
    item.slug,
    item.number !== null ? String(item.number) : '',
    ...item.patterns,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(search);
}

/** Sorts a copy; rows whose sort value is missing (null) always go last, in either direction. */
export function sortProblems(
  items: ProblemListItem[],
  sortBy: ProblemSortKey = 'date',
  sortOrder: 'asc' | 'desc' = sortBy === 'date' ? 'desc' : 'asc',
): ProblemListItem[] {
  const direction = sortOrder === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    const left = sortValue(a, sortBy);
    const right = sortValue(b, sortBy);

    if (left === null && right === null) return a.title.localeCompare(b.title);
    if (left === null) return 1;
    if (right === null) return -1;

    const compared =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return compared === 0 ? a.title.localeCompare(b.title) : compared * direction;
  });
}

function sortValue(item: ProblemListItem, key: ProblemSortKey): string | number | null {
  switch (key) {
    case 'number':
      return item.number;
    case 'title':
      return item.title.toLowerCase();
    case 'difficulty':
      return item.difficulty ? DIFFICULTY_RANK[item.difficulty] : null;
    case 'language':
      return item.language?.toLowerCase() ?? null;
    case 'status':
      return item.status?.toLowerCase() ?? null;
    case 'complexity':
      return item.timeComplexity ? complexityRank(item.timeComplexity) : null;
    case 'quality':
      return item.qualityScore;
    case 'date':
      return Date.parse(item.submittedAt);
  }
}

/** Orders common Big-O notations by growth rate; unrecognized notations sort after known ones. */
const COMPLEXITY_ORDER = [
  'o(1)',
  'o(logn)',
  'o(n)',
  'o(nlogn)',
  'o(n^2)',
  'o(n^3)',
  'o(2^n)',
  'o(n!)',
];

function complexityRank(notation: string): number {
  const normalized = notation.toLowerCase().replace(/\s+/g, '').replace(/²/g, '^2');
  const index = COMPLEXITY_ORDER.indexOf(normalized);
  return index === -1 ? COMPLEXITY_ORDER.length : index;
}

export function applyProblemQuery(
  items: ProblemListItem[],
  query: ProblemListQuery,
): ProblemListItem[] {
  return sortProblems(filterProblems(items, query), query.sortBy, query.sortOrder);
}
