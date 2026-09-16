import type { CodeContext } from '../context.js';
import type { PatternMatch } from '../types.js';
import { evaluatePatternRule } from './engine.js';
import { HASHING_RULES } from './rules/hashing.js';
import { LINEAR_STRUCTURE_RULES } from './rules/linearStructures.js';
import { POINTER_RULES } from './rules/pointers.js';
import { RECURSION_FAMILY_RULES } from './rules/recursionFamily.js';
import { STRUCTURE_AND_STRATEGY_RULES } from './rules/structuresAndStrategy.js';
import { TRAVERSAL_RULES } from './rules/traversal.js';
import type { PatternRule } from './types.js';

const ALL_RULES: PatternRule[] = [
  ...HASHING_RULES,
  ...POINTER_RULES,
  ...LINEAR_STRUCTURE_RULES,
  ...TRAVERSAL_RULES,
  ...RECURSION_FAMILY_RULES,
  ...STRUCTURE_AND_STRATEGY_RULES,
];

/**
 * Runs every pattern rule against `ctx` and returns every pattern whose
 * evidence cleared its threshold, sorted by confidence score (highest
 * first). Not mutually exclusive — real solutions often combine patterns
 * (e.g. Sorting + Two Pointers), so this can and often should return more
 * than one match.
 */
export function detectPatterns(ctx: CodeContext): PatternMatch[] {
  const matches: PatternMatch[] = [];
  for (const rule of ALL_RULES) {
    const match = evaluatePatternRule(rule, ctx);
    if (match) matches.push(match);
  }
  return matches.sort((a, b) => b.confidence.score - a.confidence.score);
}

export type { PatternRule, Signal } from './types.js';
