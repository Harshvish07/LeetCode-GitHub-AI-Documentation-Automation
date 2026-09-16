import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { SolutionReview } from './schemas/solutionReview.schema.js';

/**
 * Compares the deterministic (Phase 4) analysis against the AI's own
 * review and surfaces where they disagree, rather than silently preferring
 * one over the other or hiding the mismatch — the explicit requirement
 * that motivates this whole module: "If AI says O(n) but deterministic
 * analysis estimates O(n^2), expose the disagreement rather than hiding
 * it." Both `deterministic` and `ai` complexity are free-text notation
 * strings, so comparison here is a normalized string match (lowercase,
 * whitespace stripped) — not a symbolic/mathematical equivalence check.
 * "O(n log n)" and "O(nlogn)" are treated as the same; "O(n)" and "O(n^2)"
 * are not. This is a deliberately simple heuristic, not a CAS.
 */

export interface ComplexityAgreement {
  matches: boolean;
  deterministic: string;
  ai: string;
}

export interface ReviewAgreement {
  time: ComplexityAgreement;
  space: ComplexityAgreement;
  /** Pattern names (in the deterministic engine's own casing) both analyses mention. */
  patternsAgreedOn: string[];
  /** Detected by static analysis but not mentioned anywhere in the AI's `patterns` list. */
  patternsOnlyInDeterministic: string[];
  /** Mentioned by the AI but not detected by static analysis. */
  patternsOnlyInAi: string[];
  /** True if any of the above indicate a mismatch — a quick top-level flag for callers that don't need the detail. */
  hasDisagreement: boolean;
}

function normalizeComplexity(notation: string): string {
  return notation.toLowerCase().replace(/\s+/g, '');
}

function compareComplexity(deterministic: string, ai: string): ComplexityAgreement {
  return {
    matches: normalizeComplexity(deterministic) === normalizeComplexity(ai),
    deterministic,
    ai,
  };
}

function normalizePatternName(name: string): string {
  return name.trim().toLowerCase();
}

export function compareAnalyses(
  deterministic: SolutionAnalysis,
  ai: SolutionReview,
): ReviewAgreement {
  const time = compareComplexity(
    deterministic.estimatedTimeComplexity.notation,
    ai.complexity.time,
  );
  const space = compareComplexity(
    deterministic.estimatedSpaceComplexity.notation,
    ai.complexity.space,
  );

  const deterministicPatternNames = deterministic.detectedPatterns.map((p) => p.pattern);
  const deterministicNormalized = new Set(deterministicPatternNames.map(normalizePatternName));
  const aiNormalized = new Set(ai.patterns.map(normalizePatternName));

  const patternsAgreedOn = deterministicPatternNames.filter((pattern) =>
    aiNormalized.has(normalizePatternName(pattern)),
  );
  const patternsOnlyInDeterministic = deterministicPatternNames.filter(
    (pattern) => !aiNormalized.has(normalizePatternName(pattern)),
  );
  const patternsOnlyInAi = ai.patterns.filter(
    (pattern) => !deterministicNormalized.has(normalizePatternName(pattern)),
  );

  const hasDisagreement =
    !time.matches ||
    !space.matches ||
    patternsOnlyInDeterministic.length > 0 ||
    patternsOnlyInAi.length > 0;

  return {
    time,
    space,
    patternsAgreedOn,
    patternsOnlyInDeterministic,
    patternsOnlyInAi,
    hasDisagreement,
  };
}
