import type { CodeContext } from '../context.js';
import { extractFunctions } from '../shared/codeStructure.js';
import type { LoopStructure } from '../shared/codeStructure.js';
import type { AlgorithmPattern, EdgeCaseObservation, PatternMatch } from '../types.js';

/**
 * Checks for specific input-robustness concerns — distinct from
 * code-review's style/maintainability focus. Every check here is about
 * "does this code look like it accounts for a particular kind of input",
 * inferred from textual guards (an `if` near the top, a `.has()` before an
 * `.add()`) — it cannot know what the code actually does at runtime, so a
 * clean result here is not proof the edge case is handled, only that no
 * *absence* of handling was detected.
 */

const EMPTY_CHECK_SIGNAL =
  /\.length\s*===?\s*0|\.length\s*<\s*1|\blen\(\s*\w+\s*\)\s*===?\s*0|\bif\s+not\s+\w+\s*:|\.empty\(\)|\.isEmpty\(\)/;

function checkEmptyInput(ctx: CodeContext, loopStructure: LoopStructure): EdgeCaseObservation[] {
  if (loopStructure.loopCount === 0) return [];
  if (EMPTY_CHECK_SIGNAL.test(ctx.code)) return [];
  return [
    {
      concern: 'Empty input',
      detail:
        'The code loops over its input but no explicit empty-input check (e.g. a length/size guard) was found. Many loops naturally handle an empty input fine — this is a prompt to double-check, not a confirmed bug.',
      severity: 'info',
    },
  ];
}

/** Recognizes common "is this null/empty/falsy" guards on `paramName`, in either token order (`!head` vs `head == null`). */
function hasNullGuardForParam(bodyCode: string, paramName: string): boolean {
  const escaped = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`!\\s*${escaped}\\b`), // !head
    new RegExp(`\\b${escaped}\\s*==\\s*null`), // head == null
    new RegExp(`\\b${escaped}\\s*===\\s*null`), // head === null
    new RegExp(`\\b${escaped}\\s+is\\s+None\\b`), // head is None
    new RegExp(`\\bnot\\s+${escaped}\\b`), // not head
  ];
  return patterns.some((pattern) => pattern.test(bodyCode));
}

function checkNullableEntryPoint(
  ctx: CodeContext,
  patternNames: ReadonlySet<AlgorithmPattern>,
): EdgeCaseObservation[] {
  const isNodeBased =
    patternNames.has('Linked List Techniques') || patternNames.has('Tree Traversal');
  if (!isNodeBased) return [];

  const primary = extractFunctions(ctx)[0];
  if (!primary?.firstParamName) return [];

  if (hasNullGuardForParam(primary.bodyCode, primary.firstParamName)) return [];

  return [
    {
      concern: 'Null/empty node input',
      detail: `This looks like a linked-list/tree problem, but no null-check guard on \`${primary.firstParamName}\` (e.g. \`if (!${primary.firstParamName})\`) was found — verify a null/empty head or root is handled.`,
      severity: 'info',
    },
  ];
}

const OFFSET_ACCESS = /\b\w+\[\s*\w+\s*[+-]\s*1\s*\]/;

function checkOffsetAccess(ctx: CodeContext): EdgeCaseObservation[] {
  if (!OFFSET_ACCESS.test(ctx.code)) return [];
  return [
    {
      concern: 'Offset array access',
      detail:
        'An array/list access with an adjacent-index offset (e.g. `arr[i + 1]`) was found — verify the index stays in bounds for the smallest inputs (e.g. a single-element array).',
      severity: 'info',
    },
  ];
}

function checkUncheckedSetInsertion(
  ctx: CodeContext,
  patternNames: ReadonlySet<AlgorithmPattern>,
): EdgeCaseObservation[] {
  if (!patternNames.has('Hash Set') && !patternNames.has('Hash Map')) return [];
  if (!/\.add\(/.test(ctx.code)) return [];
  if (/\.has\(/.test(ctx.code)) return [];
  return [
    {
      concern: 'Duplicate handling',
      detail:
        'Elements are added to a set/map with `.add(` but no `.has(` membership check was found anywhere — verify duplicate values in the input are handled as intended.',
      severity: 'info',
    },
  ];
}

function checkRecursionBaseCase(ctx: CodeContext): EdgeCaseObservation[] {
  const observations: EdgeCaseObservation[] = [];
  for (const fn of extractFunctions(ctx)) {
    const selfCallMatch = new RegExp(
      `\\b${fn.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`,
    ).exec(fn.bodyCode);
    if (!selfCallMatch) continue;

    const beforeFirstCall = fn.bodyCode.slice(0, selfCallMatch.index);
    if (/\bif\b/.test(beforeFirstCall)) continue;

    observations.push({
      concern: 'Recursion base case',
      detail: `The recursive function \`${fn.name}\` doesn't appear to have a conditional check before its first recursive call — verify it has a base case that actually terminates.`,
      severity: 'warning',
    });
  }
  return observations;
}

export function analyzeEdgeCases(
  ctx: CodeContext,
  patterns: readonly PatternMatch[],
  loopStructure: LoopStructure,
): EdgeCaseObservation[] {
  const patternNames = new Set(patterns.map((p) => p.pattern));
  return [
    ...checkEmptyInput(ctx, loopStructure),
    ...checkNullableEntryPoint(ctx, patternNames),
    ...checkOffsetAccess(ctx),
    ...checkUncheckedSetInsertion(ctx, patternNames),
    ...checkRecursionBaseCase(ctx),
  ];
}
