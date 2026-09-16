import type { CodeContext } from '../context.js';
import type { Confidence, PatternMatch } from '../types.js';
import type { PatternRule } from './types.js';

function confidenceFromScore(score: number, matchedCount: number, totalCount: number): Confidence {
  const level = score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low';
  return {
    level,
    score,
    reason: `${matchedCount} of ${totalCount} signal(s) matched (score ${score.toFixed(2)}).`,
  };
}

/**
 * Runs every signal in `rule` against `ctx`. Reports the pattern only if the
 * matched signals' combined weight reaches `rule.reportThreshold` — see
 * types.ts for why that's a different bar than "score", and why score is
 * capped rather than a fraction of every signal's weight.
 */
export function evaluatePatternRule(rule: PatternRule, ctx: CodeContext): PatternMatch | null {
  const matched = rule.signals.filter((signal) => signal.test(ctx));
  const matchedWeight = matched.reduce((sum, signal) => sum + signal.weight, 0);

  if (matchedWeight < rule.reportThreshold) return null;

  const score = Math.min(1, matchedWeight / rule.confidenceCap);

  return {
    pattern: rule.pattern,
    confidence: confidenceFromScore(score, matched.length, rule.signals.length),
    evidence: matched.map((signal) => signal.description),
  };
}
