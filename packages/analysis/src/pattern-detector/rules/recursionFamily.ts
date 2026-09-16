import { detectRecursion } from '../../shared/codeStructure.js';
import { normalizedSignal, predicateSignal, regexSignal } from '../helpers.js';
import type { PatternRule } from '../types.js';

export const recursionRule: PatternRule = {
  pattern: 'Recursion',
  reportThreshold: 5,
  confidenceCap: 5,
  signals: [
    predicateSignal(
      'a function body calls itself by name',
      5,
      (ctx) => detectRecursion(ctx).isRecursive,
    ),
  ],
};

export const backtrackingRule: PatternRule = {
  pattern: 'Backtracking',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal('mentions "backtrack" by name', 3, /backtrack/),
    predicateSignal(
      'a recursive call is followed by an "undo" operation (`.pop()`/`.removeLast(` after adding, in the same function)',
      3,
      (ctx) => detectRecursion(ctx).isRecursive && /\.pop\(\)|\.removeLast\(/.test(ctx.code),
    ),
    predicateSignal(
      'recursion occurs inside a loop (the classic "try each choice" backtracking shape)',
      2,
      (ctx) => detectRecursion(ctx).isRecursive && /\b(for|while)\s*\(/.test(ctx.code),
    ),
  ],
};

export const dynamicProgrammingRule: PatternRule = {
  pattern: 'Dynamic Programming',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal(
      'mentions "dp"/"memo"/"dynamic programming" by name',
      3,
      /\bdp\b|\bmemo\b|dynamic programming/,
    ),
    regexSignal(
      'initializes a fixed-size table (e.g. `new int[n+1]`, `Array(n+1).fill(`, `[0] * n`)',
      3,
      /new\s+\w+\[\s*\w+[\s+-]*\d*\s*\]|Array\(\s*\w+[\s+-]*\d*\s*\)\.fill\(|\[\s*0\s*\]\s*\*\s*\(?\s*\w+/,
    ),
    predicateSignal(
      'a recursive function is paired with a cache/memo lookup (top-down memoization shape)',
      2,
      (ctx) => detectRecursion(ctx).isRecursive && /\bmemo\b|\bcache\b/i.test(ctx.code),
    ),
  ],
};

export const RECURSION_FAMILY_RULES: PatternRule[] = [
  recursionRule,
  backtrackingRule,
  dynamicProgrammingRule,
];
