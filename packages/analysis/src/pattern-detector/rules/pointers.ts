import { normalizedSignal, predicateSignal, regexSignal } from '../helpers.js';
import type { PatternRule } from '../types.js';

const POINTER_PAIR = /\b(left|lo|start)\b[\s\S]{0,300}?\b(right|hi|end)\b/;

export const twoPointersRule: PatternRule = {
  pattern: 'Two Pointers',
  reportThreshold: 3,
  confidenceCap: 6,
  signals: [
    regexSignal(
      'a loop condition compares two pointer-like variables (e.g. `left < right`)',
      3,
      /\b(left|lo|start)\s*[<>]=?\s*(right|hi|end)\b|\b(right|hi|end)\s*[<>]=?\s*(left|lo|start)\b/,
    ),
    regexSignal(
      'a `left`/`lo`/`start` pointer is advanced',
      2,
      /\b(left|lo|start)\s*(\+\+|\+=|-=)/,
    ),
    regexSignal('a `right`/`hi`/`end` pointer is advanced', 2, /\b(right|hi|end)\s*(--|-=|\+=)/),
    regexSignal('both a low-side and high-side pointer variable are declared', 1, POINTER_PAIR),
  ],
};

export const slidingWindowRule: PatternRule = {
  pattern: 'Sliding Window',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    predicateSignal(
      'a `while` loop that shrinks a `left`/`start` pointer appears after a `for` loop header (classic expand/contract window shape)',
      3,
      (ctx) => {
        // A regex spanning "for(...) { ... while(...) { ... left++" breaks on
        // any nested parens inside the while condition (e.g. `.has(...)`),
        // since a naive `\([^)]*\)` stops at the first inner `)`, not the
        // one actually closing the while's own condition. Plain substring
        // search sidesteps that instead of trying to balance parens in a
        // regex.
        const forIndex = ctx.code.search(/\bfor\s*\(/);
        if (forIndex === -1) return false;
        const whileIndex = ctx.code.indexOf('while', forIndex);
        if (whileIndex === -1) return false;
        const windowAfterWhile = ctx.code.slice(whileIndex, whileIndex + 500);
        return /\b(left|start)\s*(\+\+|\+=)/.test(windowAfterWhile);
      },
    ),
    normalizedSignal('mentions a "window" by name', 2, /\bwindow\b/),
    regexSignal(
      'a low-side and high-side pointer co-occur near "substring"/"subarray"/"window"',
      1,
      /\b(left|start)\b[\s\S]{0,300}?\b(right|end)\b[\s\S]{0,80}?(window|substring|subarray)/i,
    ),
  ],
};

export const binarySearchRule: PatternRule = {
  pattern: 'Binary Search',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal('mentions "binary search" / "binarysearch" by name', 3, /binary[\s_]?search/),
    regexSignal(
      'computes a midpoint (`mid = (lo + hi) / 2`-shaped expression)',
      3,
      /\bmid\s*=\s*\w+\s*\+\s*\(?\s*\(?\s*\w+\s*-\s*\w+\s*\)?\s*\/\/?\s*2|\bmid\s*=\s*\(\s*\w+\s*\+\s*\w+\s*\)\s*(\/\/?\s*2|>>\s*1)/,
    ),
    regexSignal(
      'a `while` loop condition compares low/high bounds (e.g. `lo <= hi`)',
      2,
      /\bwhile\s*\(\s*(lo|low|left)\s*<=?\s*(hi|high|right)/,
    ),
    regexSignal(
      'a low bound is initialized to 0 and a high bound to a length/size',
      1,
      /\b(lo|low|left)\s*=\s*0\b[\s\S]{0,200}?\b(hi|high|right)\s*=\s*[\w.]*(length|size|count)/,
    ),
  ],
};

export const prefixSumRule: PatternRule = {
  pattern: 'Prefix Sum',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal(
      'names a variable "prefix"/"prefixsum"/"cumulative"',
      3,
      /\bprefix(sum)?\b|\bcumulative\b/,
    ),
    regexSignal(
      'a running-total assignment reads the previous index of the same array (`prefix[i] = prefix[i-1] + ...`)',
      3,
      /(\w+)\[[^\]]+\]\s*=\s*\1\[[^\]]+\]\s*\+/,
    ),
  ],
};

export const POINTER_RULES: PatternRule[] = [
  twoPointersRule,
  slidingWindowRule,
  binarySearchRule,
  prefixSumRule,
];
