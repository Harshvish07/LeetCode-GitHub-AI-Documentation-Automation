import { describe, expect, it } from 'vitest';
import { findPatternsInText, normalizePattern, normalizePatterns } from './patterns.js';

describe('normalizePattern', () => {
  it.each([
    ['Hash Map', 'Hash Map'],
    ['Hash Set', 'Hash Map'],
    ['Hashing', 'Hash Map'],
    ['Two Pointers', 'Two Pointers'],
    ['two-pointer technique', 'Two Pointers'],
    ['Fast and Slow Pointers', 'Two Pointers'],
    ['Sliding Window', 'Sliding Window'],
    ['Binary Search', 'Binary Search'],
    ['Stack', 'Stack'],
    ['Monotonic Stack', 'Stack'],
    ['Queue', 'Queue'],
    ['BFS', 'BFS'],
    ['Breadth-First Search', 'BFS'],
    ['DFS', 'DFS'],
    ['Depth-First Search', 'DFS'],
    ['Heap / Priority Queue', 'Heap'],
    ['Greedy', 'Greedy'],
    ['Backtracking', 'Backtracking'],
    ['Dynamic Programming', 'Dynamic Programming'],
    ['DP', 'Dynamic Programming'],
    ['Memoization', 'Dynamic Programming'],
    ['Graph Traversal', 'Graph'],
    ['Topological Sort', 'Graph'],
    ['Tree Traversal', 'Tree'],
    ['Binary Search Tree', 'Tree'],
    ['Prefix Sum', 'Prefix Sum'],
    ['Sorting', 'Sorting'],
    ['Merge Sort', 'Sorting'],
  ])('maps "%s" to %s', (raw, expected) => {
    expect(normalizePattern(raw)).toBe(expected);
  });

  it.each(['Brute Force', 'Nested Loops', 'Recursion', 'Linked List Techniques', '', '   '])(
    'leaves untracked pattern "%s" unmapped rather than guessing',
    (raw) => {
      expect(normalizePattern(raw)).toBeNull();
    },
  );

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizePattern('  HASH map  ')).toBe('Hash Map');
  });
});

describe('normalizePatterns', () => {
  it('de-duplicates aliases of the same pattern', () => {
    expect(normalizePatterns(['Hash Map', 'Hashing', 'hash set'])).toEqual(['Hash Map']);
  });

  it('returns patterns in the dashboard display order, not input order', () => {
    expect(normalizePatterns(['Sorting', 'Two Pointers', 'Hash Map'])).toEqual([
      'Hash Map',
      'Two Pointers',
      'Sorting',
    ]);
  });

  it('drops untracked patterns', () => {
    expect(normalizePatterns(['Brute Force', 'Stack'])).toEqual(['Stack']);
  });

  it('returns an empty list for no input', () => {
    expect(normalizePatterns([])).toEqual([]);
  });
});

describe('findPatternsInText', () => {
  it('finds every tracked pattern named in a sentence, in display order', () => {
    expect(
      findPatternsInText('Sort first, then use two pointers; a hash map avoids the rescan.'),
    ).toEqual(['Hash Map', 'Two Pointers', 'Sorting']);
  });

  it('returns nothing for text that names no tracked pattern', () => {
    expect(findPatternsInText('Iterate once and keep a running maximum.')).toEqual([]);
    expect(findPatternsInText('')).toEqual([]);
  });
});
