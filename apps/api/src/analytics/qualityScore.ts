export interface QualityInput {
  isOptimal: boolean;
  correctnessConcernsCount: number;
  improvementsCount: number;
  hasDisagreement: boolean;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * A single 0-100 "how solid is this solution" number for the dashboard,
 * derived only from what the AI review and the static-vs-AI agreement
 * already say — no new judgment is introduced here. Starts at 100 and
 * subtracts, each penalty capped so no single category can zero the score:
 *
 * - not asymptotically optimal ........ -25
 * - each correctness concern .......... -12 (max -36)
 * - each suggested improvement ........ -4  (max -12)
 * - static analysis and AI disagreed .. -5
 * - AI's own confidence: low -8, medium -3
 *
 * It is a heuristic ranking aid, not a grade: see docs/database.md#quality-score.
 */
export function computeQualityScore(input: QualityInput): number {
  let score = 100;

  if (!input.isOptimal) score -= 25;
  score -= Math.min(input.correctnessConcernsCount * 12, 36);
  score -= Math.min(input.improvementsCount * 4, 12);
  if (input.hasDisagreement) score -= 5;
  if (input.confidence === 'low') score -= 8;
  else if (input.confidence === 'medium') score -= 3;

  return Math.max(0, Math.min(100, score));
}

/** A reviewed solution "needs improvement" when it isn't optimal or has correctness concerns. */
export function needsImprovement(input: {
  isOptimal: boolean;
  correctnessConcernsCount: number;
}): boolean {
  return !input.isOptimal || input.correctnessConcernsCount > 0;
}
