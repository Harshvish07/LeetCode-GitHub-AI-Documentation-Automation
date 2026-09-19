import { describe, expect, it } from 'vitest';
import { computeQualityScore, needsImprovement, type QualityInput } from './qualityScore.js';

const perfect: QualityInput = {
  isOptimal: true,
  correctnessConcernsCount: 0,
  improvementsCount: 0,
  hasDisagreement: false,
  confidence: 'high',
};

describe('computeQualityScore', () => {
  it('gives an optimal, concern-free, high-confidence review 100', () => {
    expect(computeQualityScore(perfect)).toBe(100);
  });

  it('subtracts 25 for a non-optimal solution', () => {
    expect(computeQualityScore({ ...perfect, isOptimal: false })).toBe(75);
  });

  it('subtracts 12 per correctness concern, capped at 36', () => {
    expect(computeQualityScore({ ...perfect, correctnessConcernsCount: 1 })).toBe(88);
    expect(computeQualityScore({ ...perfect, correctnessConcernsCount: 3 })).toBe(64);
    expect(computeQualityScore({ ...perfect, correctnessConcernsCount: 10 })).toBe(64);
  });

  it('subtracts 4 per improvement, capped at 12', () => {
    expect(computeQualityScore({ ...perfect, improvementsCount: 2 })).toBe(92);
    expect(computeQualityScore({ ...perfect, improvementsCount: 9 })).toBe(88);
  });

  it('subtracts 5 when static analysis and the AI disagreed', () => {
    expect(computeQualityScore({ ...perfect, hasDisagreement: true })).toBe(95);
  });

  it('subtracts for lower AI confidence', () => {
    expect(computeQualityScore({ ...perfect, confidence: 'medium' })).toBe(97);
    expect(computeQualityScore({ ...perfect, confidence: 'low' })).toBe(92);
  });

  it('combines every penalty, and never goes below 0', () => {
    const worst: QualityInput = {
      isOptimal: false,
      correctnessConcernsCount: 99,
      improvementsCount: 99,
      hasDisagreement: true,
      confidence: 'low',
    };
    expect(computeQualityScore(worst)).toBe(100 - 25 - 36 - 12 - 5 - 8);
    expect(computeQualityScore(worst)).toBeGreaterThanOrEqual(0);
  });
});

describe('needsImprovement', () => {
  it('is false for an optimal solution with no concerns', () => {
    expect(needsImprovement({ isOptimal: true, correctnessConcernsCount: 0 })).toBe(false);
  });

  it('is true when not optimal', () => {
    expect(needsImprovement({ isOptimal: false, correctnessConcernsCount: 0 })).toBe(true);
  });

  it('is true when optimal but with a correctness concern', () => {
    expect(needsImprovement({ isOptimal: true, correctnessConcernsCount: 1 })).toBe(true);
  });
});
