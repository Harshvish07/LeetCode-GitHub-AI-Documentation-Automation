import { describe, expect, it } from 'vitest';
import { buildCodeContext } from '../context.js';
import { analyzeLoopStructure } from '../shared/codeStructure.js';
import { reviewCodeQuality } from './index.js';

function review(code: string, language: string | null = 'JavaScript') {
  const ctx = buildCodeContext(code, language);
  return reviewCodeQuality(ctx, analyzeLoopStructure(ctx));
}

describe('reviewCodeQuality', () => {
  it('flags deeply nested loops (3+)', () => {
    const observations = review(`
      function f(a) {
        for (let i = 0; i < a.length; i++) {
          for (let j = 0; j < a.length; j++) {
            for (let k = 0; k < a.length; k++) { touch(i, j, k); }
          }
        }
      }
    `);
    expect(
      observations.some((o) => o.category === 'nested-loops' && o.severity === 'warning'),
    ).toBe(true);
  });

  it('suggests a hash map when nested loops co-occur with map operations', () => {
    const observations = review(`
      function f(nums, target) {
        const seen = new Map();
        for (let i = 0; i < nums.length; i++) {
          for (let j = 0; j < nums.length; j++) {
            if (seen.has(nums[i] + nums[j])) return true;
          }
        }
        seen.set(1, 1);
        return false;
      }
    `);
    expect(observations.some((o) => o.category === 'nested-loops')).toBe(true);
  });

  it('does not flag a single clean loop', () => {
    const observations = review(
      'function sum(nums) { let s = 0; for (let i = 0; i < nums.length; i++) { s += nums[i]; } return s; }',
    );
    expect(observations.some((o) => o.category === 'nested-loops')).toBe(false);
  });

  it('flags repeated non-trivial expressions', () => {
    const observations = review(`
      function f(items) {
        if (computeExpensiveValue(items) > 0) {
          use(computeExpensiveValue(items));
        }
        return computeExpensiveValue(items);
      }
    `);
    expect(observations.some((o) => o.category === 'repeated-computation')).toBe(true);
  });

  it('flags duplicated lines', () => {
    const observations = review(`
      function f(a, b) {
        const totalScoreForReport = a + b;
        console.log('debug: ' + totalScoreForReport);
        console.log('debug: ' + totalScoreForReport);
        return totalScoreForReport;
      }
    `);
    expect(observations.some((o) => o.category === 'duplication')).toBe(true);
  });

  it('flags a wasteful string/number round-trip conversion', () => {
    const observations = review('function f(x) { return parseInt(x.toString()); }');
    expect(observations.some((o) => o.category === 'conversion')).toBe(true);
  });

  it('flags mutation of the first parameter with no apparent copy', () => {
    const observations = review('function f(nums) { nums.sort((a, b) => a - b); return nums; }');
    expect(observations.some((o) => o.category === 'mutation' && o.severity === 'warning')).toBe(
      true,
    );
  });

  it('does not flag mutation when the parameter is copied first', () => {
    const observations = review(
      'function f(nums) { const copy = [...nums]; copy.sort((a, b) => a - b); return copy; }',
    );
    expect(observations.some((o) => o.category === 'mutation')).toBe(false);
  });

  it('flags overly long lines', () => {
    const longLine = `function f() { return ${'1 + '.repeat(40)}1; }`;
    const observations = review(longLine);
    expect(observations.some((o) => o.category === 'readability')).toBe(true);
  });

  it('returns no observations for short, clean code', () => {
    const observations = review('function add(a, b) { return a + b; }');
    expect(observations).toEqual([]);
  });
});
