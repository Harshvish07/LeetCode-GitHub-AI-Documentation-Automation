import { describe, expect, it } from 'vitest';
import { compareComplexity, complexityGrowthRank } from './complexity.js';

describe('complexityGrowthRank', () => {
  it('ranks known notations by growth', () => {
    expect(complexityGrowthRank('O(1)')).toBeLessThan(complexityGrowthRank('O(n)')!);
    expect(complexityGrowthRank('O(n log n)')).toBeLessThan(complexityGrowthRank('O(n^2)')!);
  });

  it('normalizes spacing and superscripts', () => {
    expect(complexityGrowthRank('O( n² )')).toBe(complexityGrowthRank('O(n^2)'));
    expect(complexityGrowthRank('O(n * n)')).toBe(complexityGrowthRank('O(n^2)'));
  });

  it('returns null for unrecognized or missing notation', () => {
    expect(complexityGrowthRank('O(m * n)')).toBeNull();
    expect(complexityGrowthRank('Unknown')).toBeNull();
    expect(complexityGrowthRank(null)).toBeNull();
  });
});

describe('compareComplexity', () => {
  it('detects improvement, regression, and no change', () => {
    expect(compareComplexity('O(n^2)', 'O(n)')).toBe('improved');
    expect(compareComplexity('O(n)', 'O(n^2)')).toBe('regressed');
    expect(compareComplexity('O(n)', 'O(n)')).toBe('same');
  });

  it('is unknown when either side cannot be ranked', () => {
    expect(compareComplexity('O(n^2)', 'O(m * n)')).toBe('unknown');
    expect(compareComplexity(null, 'O(n)')).toBe('unknown');
  });
});
