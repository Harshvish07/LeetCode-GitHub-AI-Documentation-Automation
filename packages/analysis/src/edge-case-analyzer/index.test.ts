import { describe, expect, it } from 'vitest';
import { buildCodeContext } from '../context.js';
import { detectPatterns } from '../pattern-detector/index.js';
import { analyzeLoopStructure } from '../shared/codeStructure.js';
import { analyzeEdgeCases } from './index.js';

function edgeCases(code: string, language: string | null = 'JavaScript') {
  const ctx = buildCodeContext(code, language);
  const patterns = detectPatterns(ctx);
  return analyzeEdgeCases(ctx, patterns, analyzeLoopStructure(ctx));
}

describe('analyzeEdgeCases', () => {
  it('flags a loop with no visible empty-input guard', () => {
    const observations = edgeCases(
      'function sum(nums) { let s = 0; for (let i = 0; i < nums.length; i++) { s += nums[i]; } return s; }',
    );
    expect(observations.some((o) => o.concern === 'Empty input')).toBe(true);
  });

  it('does not flag empty input when a length guard is present', () => {
    const observations = edgeCases(
      'function sum(nums) { if (nums.length === 0) return 0; let s = 0; for (let i = 0; i < nums.length; i++) { s += nums[i]; } return s; }',
    );
    expect(observations.some((o) => o.concern === 'Empty input')).toBe(false);
  });

  it('flags a linked-list function with no null guard on its head parameter', () => {
    const observations = edgeCases(
      'function length(head) { let count = 0; let curr = head; while (curr instanceof ListNode) { count++; curr = curr.next; } return count; }',
    );
    expect(observations.some((o) => o.concern === 'Null/empty node input')).toBe(true);
  });

  it('does not flag a linked-list function that guards its head parameter', () => {
    const observations = edgeCases(
      'function length(head) { if (!head) return 0; let count = 0; let curr = head; while (curr instanceof ListNode) { count++; curr = curr.next; } return count; }',
    );
    expect(observations.some((o) => o.concern === 'Null/empty node input')).toBe(false);
  });

  it('flags an offset array access', () => {
    const observations = edgeCases('function f(arr) { return arr[0] + arr[1 + 1]; }');
    expect(observations.some((o) => o.concern === 'Offset array access')).toBe(true);
  });

  it('flags set insertion with no membership check anywhere', () => {
    const observations = edgeCases(
      'function f(nums) { const seen = new Set(); for (const n of nums) { seen.add(n); } return seen.size; }',
    );
    expect(observations.some((o) => o.concern === 'Duplicate handling')).toBe(true);
  });

  it('does not flag set insertion when a membership check is present', () => {
    const observations = edgeCases(
      'function f(nums) { const seen = new Set(); for (const n of nums) { if (seen.has(n)) return true; seen.add(n); } return false; }',
    );
    expect(observations.some((o) => o.concern === 'Duplicate handling')).toBe(false);
  });

  it('flags a recursive function with no visible base case', () => {
    const observations = edgeCases('function loopForever(n) { return loopForever(n + 1); }');
    expect(
      observations.some((o) => o.concern === 'Recursion base case' && o.severity === 'warning'),
    ).toBe(true);
  });

  it('does not flag a recursive function with a visible base case', () => {
    const observations = edgeCases(
      'function fib(n) { if (n <= 1) return n; return fib(n - 1) + fib(n - 2); }',
    );
    expect(observations.some((o) => o.concern === 'Recursion base case')).toBe(false);
  });
});
