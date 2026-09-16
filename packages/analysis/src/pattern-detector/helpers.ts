import type { CodeContext } from '../context.js';
import type { Signal } from './types.js';

/**
 * None of these regexes use the `g` flag: signals are defined once as
 * module-level constants and `.test()`-ed against many different inputs
 * over the analyzer's lifetime, and a global regex's `.lastIndex` state
 * would corrupt results across calls.
 */

/** Tests against the raw code — use for case-sensitive keywords/class names (`Map`, `HashMap`, `TreeNode`, ...). */
export function regexSignal(description: string, weight: number, pattern: RegExp): Signal {
  return { description, weight, test: (ctx: CodeContext) => pattern.test(ctx.code) };
}

/** Tests against the lowercased code — use for generic keyword mentions ("backtrack", "memo", "greedy", ...). */
export function normalizedSignal(description: string, weight: number, pattern: RegExp): Signal {
  return { description, weight, test: (ctx: CodeContext) => pattern.test(ctx.normalized) };
}

export function predicateSignal(
  description: string,
  weight: number,
  test: (ctx: CodeContext) => boolean,
): Signal {
  return { description, weight, test };
}
