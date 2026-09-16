import type { CodeContext } from '../context.js';
import type { LoopStructure } from '../shared/codeStructure.js';
import { extractFunctions, stripStringsAndComments } from '../shared/codeStructure.js';
import type { CodeQualityObservation } from '../types.js';

/**
 * Style/maintainability heuristics over the source text — nothing here
 * touches correctness (see edge-case-analyzer for that). Every check is
 * conservative by design: it's better to miss a real issue than to flag a
 * false one confidently, so each detector only fires on a fairly explicit
 * textual signal, never a guess about intent.
 */

const COMMON_LOOP_COUNTERS = new Set(['i', 'j', 'k', 'n', 'm', 'x', 'y']);

function checkNestedLoops(
  ctx: CodeContext,
  loopStructure: LoopStructure,
): CodeQualityObservation[] {
  const observations: CodeQualityObservation[] = [];
  if (loopStructure.maxNestingDepth >= 3) {
    observations.push({
      category: 'nested-loops',
      severity: 'warning',
      message: `${loopStructure.maxNestingDepth} levels of nested loops were found — verify this depth of nesting is actually necessary for the input size.`,
    });
  } else if (
    loopStructure.maxNestingDepth === 2 &&
    /\.get\(|\.set\(|\.has\(|new\s+Map\(|new\s+Set\(/.test(ctx.code)
  ) {
    observations.push({
      category: 'nested-loops',
      severity: 'info',
      message:
        'Nested loops were found alongside hash-based lookups — a single pass using a hash map/set may be able to replace one of the loops.',
    });
  }
  return observations;
}

function checkRepeatedComputation(ctx: CodeContext): CodeQualityObservation[] {
  const clean = stripStringsAndComments(ctx.code);
  const callLike = clean.match(/\b[\w.]+\([^()]{3,60}\)/g) ?? [];
  const counts = new Map<string, number>();
  for (const expr of callLike) {
    const trimmed = expr.trim();
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  const observations: CodeQualityObservation[] = [];
  for (const [expr, count] of counts) {
    if (count >= 3 && !/console\.log|print\(|System\.out/.test(expr)) {
      observations.push({
        category: 'repeated-computation',
        severity: 'info',
        message: `The expression \`${expr}\` appears ${count} times — consider computing it once and reusing the result.`,
      });
    }
  }
  return observations.slice(0, 3);
}

function checkNaming(ctx: CodeContext): CodeQualityObservation[] {
  const observations: CodeQualityObservation[] = [];
  const declarations = ctx.code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=/g);
  const flagged = new Set<string>();
  for (const match of declarations) {
    const name = match[1]!;
    if (name.length === 1 && !COMMON_LOOP_COUNTERS.has(name) && !flagged.has(name)) {
      flagged.add(name);
    }
  }
  if (flagged.size > 0) {
    observations.push({
      category: 'naming',
      severity: 'info',
      message: `Variable name(s) ${[...flagged].map((n) => `\`${n}\``).join(', ')} are single letters outside common loop-counter conventions — consider a more descriptive name where reasonably possible.`,
    });
  }
  return observations;
}

function checkDuplicatedLogic(ctx: CodeContext): CodeQualityObservation[] {
  const counts = new Map<string, number>();
  for (const rawLine of ctx.lines) {
    const line = rawLine.trim();
    if (line.length < 15) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  const observations: CodeQualityObservation[] = [];
  for (const [line, count] of counts) {
    if (count >= 2) {
      observations.push({
        category: 'duplication',
        severity: 'info',
        message: `The line \`${line}\` appears verbatim ${count} times — consider extracting a helper function.`,
      });
    }
  }
  return observations.slice(0, 3);
}

const WASTEFUL_CONVERSIONS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\.toString\(\)\s*\.\s*split\(\s*['"]{2}\s*\)\s*\.\s*join\(\s*['"]{2}\s*\)/,
    message:
      "A string is converted with `.toString().split('').join('')`, which is a no-op round trip.",
  },
  {
    pattern: /parseInt\(\s*\w+\.toString\(\)\s*\)/,
    message:
      "A value is converted with `.toString()` and immediately parsed back with `parseInt(...)` — if it's already a number, this round trip is unnecessary.",
  },
  {
    pattern: /Number\(\s*String\(\s*\w+\s*\)\s*\)/,
    message: 'A value is converted with `String(...)` and immediately back with `Number(...)`.',
  },
  {
    pattern: /int\(\s*str\(\s*\w+\s*\)\s*\)/,
    message: 'A value is converted with `str(...)` and immediately back with `int(...)`.',
  },
];

function checkUnnecessaryConversions(ctx: CodeContext): CodeQualityObservation[] {
  const observations: CodeQualityObservation[] = [];
  for (const { pattern, message } of WASTEFUL_CONVERSIONS) {
    if (pattern.test(ctx.code)) {
      observations.push({ category: 'conversion', severity: 'info', message });
    }
  }
  return observations;
}

const COPY_SIGNAL = /\[\s*\.\.\.\s*\w+\s*\]|\.slice\(\)|\.copy\(\)|list\(\s*\w+\s*\)|\.clone\(\)/;
const MUTATING_CALLS = [
  '.sort(',
  '.reverse(',
  '.push(',
  '.pop(',
  '.splice(',
  '.shift(',
  '.unshift(',
];

function checkMutation(ctx: CodeContext): CodeQualityObservation[] {
  const functions = extractFunctions(ctx);
  const primary = functions[0];
  if (!primary?.firstParamName) return [];

  const name = primary.firstParamName;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mutatingCallOnParam = MUTATING_CALLS.some((call) =>
    new RegExp(`\\b${escaped}\\s*${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(
      primary.bodyCode,
    ),
  );
  const directIndexAssignment = new RegExp(`\\b${escaped}\\s*\\[[^\\]]+\\]\\s*=(?!=)`).test(
    primary.bodyCode,
  );

  if ((mutatingCallOnParam || directIndexAssignment) && !COPY_SIGNAL.test(primary.bodyCode)) {
    return [
      {
        category: 'mutation',
        severity: 'warning',
        message: `The input parameter \`${name}\` appears to be mutated in place, with no apparent copy made first — this may have side effects on the caller's data if that's unintended.`,
      },
    ];
  }
  return [];
}

function checkReadability(ctx: CodeContext): CodeQualityObservation[] {
  const observations: CodeQualityObservation[] = [];
  const longLines = ctx.lines.filter((line) => line.length > 120).length;
  if (longLines > 0) {
    observations.push({
      category: 'readability',
      severity: 'info',
      message: `${longLines} line(s) exceed 120 characters — consider breaking them up for readability.`,
    });
  }
  return observations;
}

export function reviewCodeQuality(
  ctx: CodeContext,
  loopStructure: LoopStructure,
): CodeQualityObservation[] {
  return [
    ...checkNestedLoops(ctx, loopStructure),
    ...checkRepeatedComputation(ctx),
    ...checkNaming(ctx),
    ...checkDuplicatedLogic(ctx),
    ...checkUnnecessaryConversions(ctx),
    ...checkMutation(ctx),
    ...checkReadability(ctx),
  ];
}
