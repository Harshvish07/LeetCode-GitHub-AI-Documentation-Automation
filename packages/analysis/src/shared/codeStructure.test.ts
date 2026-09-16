import { describe, expect, it } from 'vitest';
import { buildCodeContext } from '../context.js';
import { analyzeLoopStructure, detectRecursion, extractFunctions } from './codeStructure.js';

describe('analyzeLoopStructure', () => {
  it('finds no loops in straight-line code', () => {
    const ctx = buildCodeContext('function f(a, b) { return a + b; }', 'JavaScript');
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 0, loopCount: 0 });
  });

  it('finds a single loop (depth 1)', () => {
    const ctx = buildCodeContext(
      'function f(nums) { let sum = 0; for (let i = 0; i < nums.length; i++) { sum += nums[i]; } return sum; }',
      'JavaScript',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 1, loopCount: 1 });
  });

  it('finds nested loops (depth 2) in brace-based code', () => {
    const ctx = buildCodeContext(
      `function f(grid) {
        for (let i = 0; i < grid.length; i++) {
          for (let j = 0; j < grid[0].length; j++) {
            visit(grid[i][j]);
          }
        }
      }`,
      'JavaScript',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 2, loopCount: 2 });
  });

  it('does not count sequential (non-nested) loops as nested', () => {
    const ctx = buildCodeContext(
      `function f(nums) {
        for (let i = 0; i < nums.length; i++) { touch(i); }
        for (let j = 0; j < nums.length; j++) { touch(j); }
      }`,
      'JavaScript',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 1, loopCount: 2 });
  });

  it('ignores for/while keywords inside strings and comments', () => {
    const ctx = buildCodeContext(
      `function f() {
        // for (let i = 0; i < 10; i++) { nope(); }
        const msg = "while this is just a string";
        return 1;
      }`,
      'JavaScript',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 0, loopCount: 0 });
  });

  it('handles a while loop', () => {
    const ctx = buildCodeContext(
      'function f(n) { while (n > 0) { n--; } return n; }',
      'JavaScript',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 1, loopCount: 1 });
  });

  it('analyzes Python nested loops via indentation', () => {
    const ctx = buildCodeContext(
      `def f(grid):
    for i in range(len(grid)):
        for j in range(len(grid[0])):
            visit(grid[i][j])
    return grid`,
      'Python3',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 2, loopCount: 2 });
  });

  it('analyzes Python sequential loops as depth 1', () => {
    const ctx = buildCodeContext(
      `def f(nums):
    for i in nums:
        touch(i)
    for j in nums:
        touch(j)`,
      'Python3',
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 1, loopCount: 2 });
  });

  it('falls back to indentation analysis for unlabeled Python-shaped code', () => {
    const ctx = buildCodeContext(
      `def f(nums):
    for i in nums:
        touch(i)`,
      null,
    );
    expect(analyzeLoopStructure(ctx)).toEqual({ maxNestingDepth: 1, loopCount: 1 });
  });
});

describe('detectRecursion', () => {
  it('detects a simple self-recursive function (JS)', () => {
    const ctx = buildCodeContext(
      'function fib(n) { if (n <= 1) return n; return fib(n - 1) + fib(n - 2); }',
      'JavaScript',
    );
    const result = detectRecursion(ctx);
    expect(result.isRecursive).toBe(true);
    expect(result.functionNames).toContain('fib');
  });

  it('does not report recursion for a purely iterative function', () => {
    const ctx = buildCodeContext(
      'function sum(nums) { let s = 0; for (let i = 0; i < nums.length; i++) { s += nums[i]; } return s; }',
      'JavaScript',
    );
    expect(detectRecursion(ctx).isRecursive).toBe(false);
  });

  it('detects Python recursion', () => {
    const ctx = buildCodeContext(
      `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)`,
      'Python3',
    );
    const result = detectRecursion(ctx);
    expect(result.isRecursive).toBe(true);
    expect(result.functionNames).toContain('fib');
  });

  it('does not confuse two same-named calls in different, non-recursive functions with recursion', () => {
    const ctx = buildCodeContext(
      'function helper(x) { return x * 2; } function main(x) { return helper(x); }',
      'JavaScript',
    );
    const result = detectRecursion(ctx);
    expect(result.isRecursive).toBe(false);
  });
});

describe('extractFunctions', () => {
  it('extracts the first parameter name from a JS function', () => {
    const ctx = buildCodeContext('function twoSum(nums, target) { return []; }', 'JavaScript');
    const functions = extractFunctions(ctx);
    expect(functions[0]?.name).toBe('twoSum');
    expect(functions[0]?.firstParamName).toBe('nums');
  });

  it('extracts the first parameter name from a Java-style signature', () => {
    const ctx = buildCodeContext('int[] twoSum(int[] nums, int target) { return null; }', 'Java');
    const functions = extractFunctions(ctx);
    expect(functions[0]?.name).toBe('twoSum');
    expect(functions[0]?.firstParamName).toBe('nums');
  });

  it('extracts the first parameter name from a Python def with a type hint', () => {
    const ctx = buildCodeContext(
      `def twoSum(self, nums: List[int], target: int) -> List[int]:
    return []`,
      'Python3',
    );
    const functions = extractFunctions(ctx);
    expect(functions[0]?.name).toBe('twoSum');
    expect(functions[0]?.firstParamName).toBe('self');
  });
});
