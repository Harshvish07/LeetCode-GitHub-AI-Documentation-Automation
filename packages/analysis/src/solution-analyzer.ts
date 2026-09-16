import { reviewCodeQuality } from './code-review/index.js';
import { detectsExtraLinearStructure, estimateComplexity } from './complexity-analyzer/index.js';
import { buildCodeContext } from './context.js';
import { analyzeEdgeCases } from './edge-case-analyzer/index.js';
import { detectPatterns } from './pattern-detector/index.js';
import { analyzeLoopStructure, detectRecursion } from './shared/codeStructure.js';
import type {
  AlgorithmCharacteristics,
  CodeQualityObservation,
  ComplexityEstimate,
  Confidence,
  ConfidenceLevel,
  EdgeCaseObservation,
  PatternMatch,
  PossibleIssue,
  SolutionAnalysis,
} from './types.js';

export interface AnalyzeSolutionInput {
  code: string;
  language: string | null;
}

/**
 * The single public entry point of this package: runs every sub-analyzer
 * once over the submitted code and assembles their output into one
 * SolutionAnalysis. Nothing here calls an AI provider or the network —
 * every field is derived purely from the source text, per Phase 4's scope.
 */
export function analyzeSolution(input: AnalyzeSolutionInput): SolutionAnalysis {
  const ctx = buildCodeContext(input.code, input.language);

  const patterns = detectPatterns(ctx);
  const loopStructure = analyzeLoopStructure(ctx);
  const recursion = detectRecursion(ctx);
  const { time, space } = estimateComplexity(ctx, patterns, loopStructure, recursion);
  const codeQualityObservations = reviewCodeQuality(ctx, loopStructure);
  const edgeCaseObservations = analyzeEdgeCases(ctx, patterns, loopStructure);

  const algorithmCharacteristics: AlgorithmCharacteristics = {
    usesRecursion: recursion.isRecursive,
    usesIteration: loopStructure.loopCount > 0,
    maxLoopNestingDepth: loopStructure.maxNestingDepth,
    usesSorting: patterns.some((p) => p.pattern === 'Sorting'),
    usesHashing: patterns.some((p) => p.pattern === 'Hash Map' || p.pattern === 'Hash Set'),
    usesExtraLinearStructure: detectsExtraLinearStructure(ctx),
  };

  const possibleIssues = synthesizePossibleIssues({
    time,
    codeQualityObservations,
    edgeCaseObservations,
  });
  const confidence = deriveOverallConfidence({ patterns, time, space });

  return {
    detectedLanguage: input.language,
    detectedPatterns: patterns,
    estimatedTimeComplexity: time,
    estimatedSpaceComplexity: space,
    algorithmCharacteristics,
    possibleIssues,
    codeQualityObservations,
    edgeCaseObservations,
    confidence,
  };
}

const MAX_POSSIBLE_ISSUES = 6;

/**
 * A top-level digest of the *most actionable* findings across every
 * sub-analyzer — distinct from `codeQualityObservations`/
 * `edgeCaseObservations`, which list everything each analyzer found.
 * Deliberately only promotes warning-severity items (plus a genuinely
 * uncertain complexity estimate) so this stays a short "check these first"
 * list rather than a restatement of everything else in the analysis.
 */
function synthesizePossibleIssues(input: {
  time: ComplexityEstimate;
  codeQualityObservations: readonly CodeQualityObservation[];
  edgeCaseObservations: readonly EdgeCaseObservation[];
}): PossibleIssue[] {
  const issues: PossibleIssue[] = [];

  if (
    input.time.notation.includes('Unknown') ||
    input.time.notation.includes('2^n') ||
    input.time.confidence.level === 'low'
  ) {
    const lastReason = input.time.reasoning[input.time.reasoning.length - 1];
    issues.push({
      message: `Time complexity estimate is uncertain (${input.time.notation}, ${input.time.confidence.level} confidence)${lastReason ? ` — ${lastReason}` : ''}`,
      severity: 'warning',
      source: 'complexity-analyzer',
    });
  }

  for (const observation of input.codeQualityObservations) {
    if (observation.severity === 'warning') {
      issues.push({ message: observation.message, severity: 'warning', source: 'code-review' });
    }
  }

  for (const observation of input.edgeCaseObservations) {
    if (observation.severity === 'warning') {
      issues.push({
        message: observation.detail,
        severity: 'warning',
        source: 'edge-case-analyzer',
      });
    }
  }

  return issues.slice(0, MAX_POSSIBLE_ISSUES);
}

/**
 * The analyzer's own honest summary of how much to trust the whole
 * analysis — an average of every sub-confidence it produced, not a
 * separate guess. Zero detected patterns/signals is itself informative
 * (this code didn't match anything this heuristic recognizes) and is
 * reported as low confidence rather than silently defaulting to "medium".
 */
function deriveOverallConfidence(input: {
  patterns: readonly PatternMatch[];
  time: ComplexityEstimate;
  space: ComplexityEstimate;
}): Confidence {
  const scores = [
    ...input.patterns.map((p) => p.confidence.score),
    input.time.confidence.score,
    input.space.confidence.score,
  ];
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const level: ConfidenceLevel = average >= 0.65 ? 'high' : average >= 0.4 ? 'medium' : 'low';

  return {
    level,
    score: average,
    reason: `Averaged across ${input.patterns.length} detected pattern(s) plus the time and space complexity estimates.`,
  };
}
