import type { CodeContext } from '../context.js';
import type { LoopStructure, RecursionInfo } from '../shared/codeStructure.js';
import type {
  AlgorithmPattern,
  Confidence,
  ConfidenceLevel,
  ComplexityEstimate,
  PatternMatch,
} from '../types.js';

/**
 * A heuristic complexity *estimator*, not a prover. It reasons from
 * surface-level structural signals — loop nesting depth, whether recursion
 * was found, which patterns the pattern-detector already flagged (sorting,
 * binary search, DP, backtracking) — and is explicitly wrong whenever those
 * signals don't actually reflect what the code does (a loop that breaks
 * immediately, a recursive call that's memoized in a way this heuristic
 * didn't recognize, etc.). `reasoning` always says exactly which signals
 * drove the estimate, and `confidence` is deliberately conservative
 * whenever signals are sparse or could plausibly combine in more than one
 * way (see the "mixed loop + recursion" case below).
 */

const TWO_D_TABLE_SIGNAL =
  /new\s+\w+\[[^\]]+\]\[[^\]]+\]|Array\.from\(\{[^}]*\},\s*\(\)\s*=>\s*(new\s+Array|Array\()|\[\s*\[\s*0/;
const ONE_D_TABLE_SIGNAL =
  /new\s+\w+\[[^\]]+\]|Array\(\s*\w+[\s+-]*\d*\s*\)\.fill\(|\[\s*0\s*\]\s*\*/;
const EXTRA_STRUCTURE_SIGNAL =
  /new\s+Array\(|Array\(\s*\w+\s*\)\.fill\(|\[\s*0\s*\]\s*\*\s*\w+|new\s+ArrayList|new\s+int\[|new\s+\w+\[\w+\]|\blist\(\s*\)/;

function detectDpTableDimension(ctx: CodeContext): 1 | 2 | null {
  if (TWO_D_TABLE_SIGNAL.test(ctx.code)) return 2;
  if (ONE_D_TABLE_SIGNAL.test(ctx.code)) return 1;
  return null;
}

/** Exported for solution-analyzer.ts, which needs this same signal to populate `AlgorithmCharacteristics`. */
export function detectsExtraLinearStructure(ctx: CodeContext): boolean {
  return EXTRA_STRUCTURE_SIGNAL.test(ctx.code) || detectDpTableDimension(ctx) !== null;
}

function confidence(level: ConfidenceLevel, score: number, reasoning: string[]): Confidence {
  return { level, score, reason: reasoning.join(' ') || 'No corroborating signals were found.' };
}

function estimateTime(
  ctx: CodeContext,
  patternNames: ReadonlySet<AlgorithmPattern>,
  loopStructure: LoopStructure,
  recursion: RecursionInfo,
): ComplexityEstimate {
  const reasoning: string[] = [];

  if (recursion.isRecursive) {
    if (patternNames.has('Binary Search')) {
      reasoning.push('Recursive binary-search shape detected — halves the search space each call.');
      return { notation: 'O(log n)', confidence: confidence('medium', 0.6, reasoning), reasoning };
    }

    if (patternNames.has('Backtracking')) {
      reasoning.push(
        "Backtracking recursion detected (explores multiple branches per call) — commonly exponential or factorial, but the exact base depends on the problem's branching factor, which this heuristic cannot determine from the source alone.",
      );
      return {
        notation: 'O(2^n) (exponential, problem-dependent)',
        confidence: confidence('low', 0.25, reasoning),
        reasoning,
      };
    }

    if (patternNames.has('Dynamic Programming')) {
      const dimension = detectDpTableDimension(ctx);
      if (dimension === 2) {
        reasoning.push(
          'Recursive/memoized solution with a 2D DP table detected — likely O(n * m) distinct subproblems.',
        );
        return {
          notation: 'O(n * m)',
          confidence: confidence('medium', 0.55, reasoning),
          reasoning,
        };
      }
      reasoning.push(
        'Recursive/memoized solution with a 1D DP table detected — likely O(n) distinct subproblems.',
      );
      return { notation: 'O(n)', confidence: confidence('medium', 0.55, reasoning), reasoning };
    }

    if (loopStructure.loopCount > 0) {
      reasoning.push(
        'Both loops and recursion were detected without a matching specific pattern (DP/backtracking/binary search) — this heuristic cannot reliably tell whether they combine multiplicatively (e.g. a loop calling a recursive search each iteration) or the loop is simply inside the recursive function.',
      );
      return {
        notation: 'Unknown (mixed loop + recursion)',
        confidence: confidence('low', 0.2, reasoning),
        reasoning,
      };
    }

    reasoning.push(
      'Recursive function with an apparent self-call and no loops — treated as roughly linear (e.g. a single-branch tree/graph visit), but this is a rough guess without a more specific matching pattern.',
    );
    return { notation: 'O(n)', confidence: confidence('low', 0.35, reasoning), reasoning };
  }

  const hasSort = patternNames.has('Sorting');
  const hasBinarySearchLoop =
    patternNames.has('Binary Search') && loopStructure.maxNestingDepth === 1;

  if (loopStructure.maxNestingDepth === 0) {
    if (hasSort) {
      reasoning.push('No loop nesting was found, but a sort call was — the sort dominates.');
      return {
        notation: 'O(n log n)',
        confidence: confidence('medium', 0.6, reasoning),
        reasoning,
      };
    }
    reasoning.push('No loops or recursion were detected.');
    return { notation: 'O(1)', confidence: confidence('high', 0.8, reasoning), reasoning };
  }

  if (hasBinarySearchLoop) {
    reasoning.push(
      'A single loop with a binary-search-shaped condition (halves the range each iteration) was found.',
    );
    return { notation: 'O(log n)', confidence: confidence('medium', 0.6, reasoning), reasoning };
  }

  if (patternNames.has('Sliding Window') && loopStructure.maxNestingDepth === 2) {
    reasoning.push(
      'A sliding-window shape was detected (a shrinking loop nested inside an expanding one) — a naive nesting count would say O(n^2), but each pointer only ever moves forward across the input, so the amortized cost is O(n). Flagged as medium, not high, confidence because this override trusts the pattern match rather than proving the amortized bound directly.',
    );
    return { notation: 'O(n)', confidence: confidence('medium', 0.55, reasoning), reasoning };
  }

  if (loopStructure.maxNestingDepth === 1) {
    if (hasSort) {
      reasoning.push(
        'A sort call plus a single, non-nested loop were found — the sort dominates asymptotically.',
      );
      return {
        notation: 'O(n log n)',
        confidence: confidence('medium', 0.55, reasoning),
        reasoning,
      };
    }
    reasoning.push('A single, non-nested loop was found.');
    if (patternNames.has('Hash Map') || patternNames.has('Hash Set')) {
      reasoning.push('Hash-based lookups were also found, keeping per-element work close to O(1).');
    }
    return { notation: 'O(n)', confidence: confidence('high', 0.75, reasoning), reasoning };
  }

  if (loopStructure.maxNestingDepth === 2) {
    reasoning.push('Two levels of nested loops were found.');
    if (hasSort)
      reasoning.push(
        'A sort call was also found, but the nested loops dominate its O(n log n) cost.',
      );
    return { notation: 'O(n^2)', confidence: confidence('medium', 0.65, reasoning), reasoning };
  }

  reasoning.push(`${loopStructure.maxNestingDepth} levels of nested loops were found.`);
  return {
    notation: `O(n^${loopStructure.maxNestingDepth})`,
    confidence: confidence('low', 0.4, reasoning),
    reasoning,
  };
}

function estimateSpace(
  ctx: CodeContext,
  patternNames: ReadonlySet<AlgorithmPattern>,
  recursion: RecursionInfo,
): ComplexityEstimate {
  const reasoning: string[] = [];
  let order = 0;

  if (patternNames.has('Dynamic Programming')) {
    const dimension = detectDpTableDimension(ctx);
    if (dimension === 2) {
      order = Math.max(order, 2);
      reasoning.push('A 2D DP table was detected — up to O(n * m) auxiliary space.');
    } else {
      order = Math.max(order, 1);
      reasoning.push('A 1D DP table was detected — up to O(n) auxiliary space.');
    }
  }

  if (patternNames.has('Hash Map') || patternNames.has('Hash Set')) {
    order = Math.max(order, 1);
    reasoning.push(
      'A hash map/set was detected — up to O(n) auxiliary space if it grows with the input.',
    );
  }

  if (patternNames.has('Stack') || patternNames.has('Queue')) {
    order = Math.max(order, 1);
    reasoning.push(
      'A stack/queue was detected — up to O(n) auxiliary space if it grows with the input.',
    );
  }

  if (order === 0 && EXTRA_STRUCTURE_SIGNAL.test(ctx.code)) {
    order = Math.max(order, 1);
    reasoning.push('An additional array/list apparently sized by the input was detected.');
  }

  if (recursion.isRecursive) {
    if (patternNames.has('Binary Search')) {
      reasoning.push(
        'The recursive call stack adds roughly O(log n) for binary-search recursion depth.',
      );
    } else {
      order = Math.max(order, 1);
      reasoning.push(
        'The recursive call stack adds up to O(n) if recursion depth scales with the input.',
      );
    }
  }

  const notation = order === 0 ? 'O(1)' : order === 1 ? 'O(n)' : `O(n^${order})`;
  const level: ConfidenceLevel = reasoning.length === 0 ? 'medium' : order <= 1 ? 'medium' : 'low';
  const score = reasoning.length === 0 ? 0.5 : order <= 1 ? 0.55 : 0.35;

  if (reasoning.length === 0) {
    reasoning.push('No extra data structures or recursion sized by the input were detected.');
  }

  return { notation, confidence: confidence(level, score, reasoning), reasoning };
}

export function estimateComplexity(
  ctx: CodeContext,
  patterns: readonly PatternMatch[],
  loopStructure: LoopStructure,
  recursion: RecursionInfo,
): { time: ComplexityEstimate; space: ComplexityEstimate } {
  const patternNames = new Set(patterns.map((p) => p.pattern));
  return {
    time: estimateTime(ctx, patternNames, loopStructure, recursion),
    space: estimateSpace(ctx, patternNames, recursion),
  };
}
