import { describe, expect, it } from 'vitest';
import { buildCodeContext } from '../context.js';
import { detectPatterns } from '../pattern-detector/index.js';
import { analyzeLoopStructure, detectRecursion } from '../shared/codeStructure.js';
import { estimateComplexity } from './index.js';

function estimate(code: string, language: string | null = 'JavaScript') {
  const ctx = buildCodeContext(code, language);
  const patterns = detectPatterns(ctx);
  const loopStructure = analyzeLoopStructure(ctx);
  const recursion = detectRecursion(ctx);
  return estimateComplexity(ctx, patterns, loopStructure, recursion);
}

describe('estimateComplexity — time', () => {
  it('estimates O(1) for straight-line code with no loops or recursion', () => {
    const { time } = estimate('function add(a, b) { return a + b; }');
    expect(time.notation).toBe('O(1)');
    expect(time.confidence.level).toBe('high');
  });

  it('estimates O(n) for a single non-nested loop', () => {
    const { time } = estimate(
      'function sum(nums) { let s = 0; for (let i = 0; i < nums.length; i++) { s += nums[i]; } return s; }',
    );
    expect(time.notation).toBe('O(n)');
  });

  it('estimates O(n^2) for two nested loops', () => {
    const { time } = estimate(
      `function f(nums) {
        for (let i = 0; i < nums.length; i++) {
          for (let j = 0; j < nums.length; j++) {
            touch(nums[i], nums[j]);
          }
        }
      }`,
    );
    expect(time.notation).toBe('O(n^2)');
  });

  it('estimates O(log n) for a binary-search loop', () => {
    const { time } = estimate(
      `function search(nums, target) {
        let lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
          const mid = lo + Math.floor((hi - lo) / 2);
          if (nums[mid] === target) return mid;
          if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
        }
        return -1;
      }`,
    );
    expect(time.notation).toBe('O(log n)');
  });

  it('overrides a sliding-window shape from O(n^2) to amortized O(n)', () => {
    const { time } = estimate(`
      function lengthOfLongestSubstring(s) {
        const seen = new Set();
        let left = 0;
        let maxLen = 0;
        for (let right = 0; right < s.length; right++) {
          while (seen.has(s[right])) {
            seen.delete(s[left]);
            left++;
          }
          seen.add(s[right]);
          maxLen = Math.max(maxLen, right - left + 1);
        }
        return maxLen;
      }
    `);
    expect(time.notation).toBe('O(n)');
  });

  it('estimates O(n log n) when a sort call dominates a single pass', () => {
    const { time } = estimate('function f(nums) { return nums.sort((a, b) => a - b); }');
    expect(time.notation).toBe('O(n log n)');
  });

  it('estimates O(n) for simple linear recursion with no loops', () => {
    const { time } = estimate(
      'function depth(node) { if (!node) return 0; return 1 + Math.max(depth(node.left), depth(node.right)); }',
    );
    expect(time.notation).toBe('O(n)');
    expect(time.confidence.level).toBe('low');
  });

  it('flags backtracking recursion as exponential with low confidence', () => {
    const { time } = estimate(
      `function backtrack(path, nums, result) {
        if (path.length === nums.length) { result.push([...path]); return; }
        for (const n of nums) {
          if (path.includes(n)) continue;
          path.push(n);
          backtrack(path, nums, result);
          path.pop();
        }
      }`,
    );
    expect(time.notation).toContain('2^n');
    expect(time.confidence.level).toBe('low');
  });

  it('flags mixed loop + recursion (no specific pattern) as Unknown, low confidence', () => {
    const { time } = estimate(
      `function f(n) {
        for (let i = 0; i < n; i++) { touch(i); }
        return g(n);
      }
      function g(n) { if (n <= 0) return 0; return 1 + g(n - 1); }`,
    );
    expect(time.notation).toContain('Unknown');
    expect(time.confidence.level).toBe('low');
  });
});

describe('estimateComplexity — space', () => {
  it('estimates O(1) when nothing extra is allocated', () => {
    const { space } = estimate('function add(a, b) { return a + b; }');
    expect(space.notation).toBe('O(1)');
  });

  it('estimates O(n) when a hash map is used', () => {
    const { space } = estimate(
      `function f(nums, target) {
        const seen = new Map();
        for (let i = 0; i < nums.length; i++) {
          if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
          seen.set(nums[i], i);
        }
        return [];
      }`,
    );
    expect(space.notation).toBe('O(n)');
  });

  it('estimates O(n) when a stack that can grow with the input is used', () => {
    const { space } = estimate(
      "function isValid(s) { const stack = []; for (const ch of s) { if (ch === '(') stack.push(ch); else if (stack.pop() !== '(') return false; } return stack.length === 0; }",
    );
    expect(space.notation).toBe('O(n)');
  });

  it('estimates O(n) for a 1D DP table', () => {
    const { space } = estimate(
      `function climbStairs(n) {
        const memo = new Array(n + 1).fill(0);
        memo[0] = 1; memo[1] = 1;
        for (let i = 2; i <= n; i++) memo[i] = memo[i - 1] + memo[i - 2];
        return memo[n];
      }`,
    );
    expect(space.notation).toBe('O(n)');
  });
});
