import type { CodeContext } from '../context.js';
import type { AlgorithmPattern, PatternMatch } from '../types.js';

/**
 * One independently-testable signal contributing toward recognizing a
 * pattern. `weight` is this signal's contribution to the matched-weight
 * total — see engine.ts for how that total becomes a report decision and a
 * confidence score.
 */
export interface Signal {
  description: string;
  weight: number;
  test: (ctx: CodeContext) => boolean;
}

/**
 * Most of a rule's signals are *alternatives*, not independent corroborating
 * evidence — `new Map(`, `HashMap<`, and `unordered_map<` are the same
 * construct in three languages, and a single-language submission can only
 * ever match one of them. So confidence is deliberately **not** "matched
 * weight ÷ every signal's weight" (that would make every real match look
 * low-confidence, since only one language's alternative can ever fire) —
 * instead:
 * - `reportThreshold`: the minimum matched weight for this pattern to be
 *   reported at all (typically equal to one strong, unambiguous signal).
 * - `confidenceCap`: the matched weight that counts as maximum confidence;
 *   `score = min(1, matchedWeight / confidenceCap)`. One strong signal
 *   alone lands in the middle of the confidence range; an *additional*,
 *   genuinely corroborating signal (e.g. a generic API-shape hint on top of
 *   the explicit type name) pushes it toward "high".
 */
export interface PatternRule {
  pattern: AlgorithmPattern;
  signals: Signal[];
  reportThreshold: number;
  confidenceCap: number;
}

export type { AlgorithmPattern, PatternMatch };
