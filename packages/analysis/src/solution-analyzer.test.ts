import { describe, expect, it } from 'vitest';
import {
  binarySearchFixture,
  longestSubstringWithoutRepeatingFixture,
  maximumSubarrayFixture,
  mergeTwoSortedListsFixture,
  numberOfIslandsFixture,
  twoSumFixture,
  validParenthesesFixture,
} from './fixtures/index.js';
import { analyzeSolution } from './solution-analyzer.js';

function patternNames(analysis: ReturnType<typeof analyzeSolution>) {
  return analysis.detectedPatterns.map((p) => p.pattern);
}

describe('analyzeSolution — fixtures', () => {
  it('Two Sum: detects Hash Map, O(n) time, O(n) space', () => {
    const analysis = analyzeSolution(twoSumFixture);
    expect(patternNames(analysis)).toContain('Hash Map');
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(n)');
    expect(analysis.estimatedSpaceComplexity.notation).toBe('O(n)');
    expect(analysis.detectedLanguage).toBe('JavaScript');
  });

  it('Valid Parentheses: detects Stack, O(n) time, O(n) space', () => {
    const analysis = analyzeSolution(validParenthesesFixture);
    expect(patternNames(analysis)).toContain('Stack');
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(n)');
    expect(analysis.estimatedSpaceComplexity.notation).toBe('O(n)');
  });

  it('Binary Search: detects Binary Search, O(log n) time, O(1) space', () => {
    const analysis = analyzeSolution(binarySearchFixture);
    expect(patternNames(analysis)).toContain('Binary Search');
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(log n)');
    expect(analysis.estimatedSpaceComplexity.notation).toBe('O(1)');
    expect(analysis.algorithmCharacteristics.usesRecursion).toBe(false);
  });

  it('Longest Substring Without Repeating Characters: detects Sliding Window + Hash Set, amortized O(n) time', () => {
    const analysis = analyzeSolution(longestSubstringWithoutRepeatingFixture);
    expect(patternNames(analysis)).toContain('Sliding Window');
    expect(patternNames(analysis)).toContain('Hash Set');
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(n)');
    expect(analysis.algorithmCharacteristics.maxLoopNestingDepth).toBe(2);
  });

  it('Maximum Subarray: an honest gap — no pattern recognized, but complexity is still estimated', () => {
    const analysis = analyzeSolution(maximumSubarrayFixture);
    expect(analysis.detectedPatterns).toEqual([]);
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(n)');
    expect(analysis.estimatedSpaceComplexity.notation).toBe('O(1)');
  });

  it('Merge Two Sorted Lists: detects Linked List Techniques, O(1) space (no extra allocation)', () => {
    const analysis = analyzeSolution(mergeTwoSortedListsFixture);
    expect(patternNames(analysis)).toContain('Linked List Techniques');
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(n)');
    expect(analysis.estimatedSpaceComplexity.notation).toBe('O(1)');
  });

  it('Number of Islands: detects DFS + Graph Traversal; honestly reports Unknown complexity for the mixed loop+recursion shape', () => {
    const analysis = analyzeSolution(numberOfIslandsFixture);
    expect(patternNames(analysis)).toContain('DFS');
    expect(patternNames(analysis)).toContain('Graph Traversal');
    expect(analysis.estimatedTimeComplexity.notation).toContain('Unknown');
    expect(analysis.estimatedTimeComplexity.confidence.level).toBe('low');
    expect(analysis.algorithmCharacteristics.usesRecursion).toBe(true);
  });

  it('every fixture analysis reports a full, well-formed SolutionAnalysis shape', () => {
    for (const fixture of [
      twoSumFixture,
      validParenthesesFixture,
      binarySearchFixture,
      longestSubstringWithoutRepeatingFixture,
      maximumSubarrayFixture,
      mergeTwoSortedListsFixture,
      numberOfIslandsFixture,
    ]) {
      const analysis = analyzeSolution(fixture);
      expect(analysis.detectedLanguage).toBe(fixture.language);
      expect(Array.isArray(analysis.detectedPatterns)).toBe(true);
      expect(typeof analysis.estimatedTimeComplexity.notation).toBe('string');
      expect(typeof analysis.estimatedSpaceComplexity.notation).toBe('string');
      expect(['low', 'medium', 'high']).toContain(analysis.confidence.level);
      expect(Array.isArray(analysis.possibleIssues)).toBe(true);
      expect(Array.isArray(analysis.codeQualityObservations)).toBe(true);
      expect(Array.isArray(analysis.edgeCaseObservations)).toBe(true);
    }
  });
});

describe('analyzeSolution — general behavior', () => {
  it('detects no patterns for trivial code, but can still be confident about its O(1) complexity', () => {
    // No recognizable algorithm pattern isn't the same as "unsure of everything" —
    // straight-line code with no loops/recursion is genuinely reliable evidence
    // for O(1), so overall confidence here is correctly driven by that, not by
    // pattern count.
    const analysis = analyzeSolution({
      code: 'function add(a, b) { return a + b; }',
      language: 'JavaScript',
    });
    expect(analysis.detectedPatterns).toEqual([]);
    expect(analysis.estimatedTimeComplexity.notation).toBe('O(1)');
    expect(analysis.estimatedTimeComplexity.confidence.level).toBe('high');
  });

  it('reports low overall confidence when signals are genuinely sparse and conflicting', () => {
    const analysis = analyzeSolution({
      code: `function f(n) {
        for (let i = 0; i < n; i++) { touch(i); }
        return g(n);
      }
      function g(n) { if (n <= 0) return 0; return 1 + g(n - 1); }`,
      language: 'JavaScript',
    });
    expect(analysis.estimatedTimeComplexity.confidence.level).toBe('low');
    expect(analysis.confidence.level).not.toBe('high');
  });

  it('never invents a detected language — echoes exactly what was passed in, including null', () => {
    const analysis = analyzeSolution({
      code: 'function add(a, b) { return a + b; }',
      language: null,
    });
    expect(analysis.detectedLanguage).toBeNull();
  });

  it('surfaces a code-quality warning in possibleIssues', () => {
    const analysis = analyzeSolution({
      code: 'function f(nums) { nums.sort((a, b) => a - b); return nums; }',
      language: 'JavaScript',
    });
    expect(analysis.codeQualityObservations.some((o) => o.category === 'mutation')).toBe(true);
    expect(analysis.possibleIssues.some((issue) => issue.source === 'code-review')).toBe(true);
  });
});
