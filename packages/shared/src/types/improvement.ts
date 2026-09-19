import type { LeetCodeDifficulty } from './leetcode.js';
import type { TrackedPattern } from './dashboard.js';

/** One submission of a problem, in the order it was received (attempt 1 is the first). */
export interface AttemptSummary {
  attemptNumber: number;
  submissionId: string;
  submittedAt: string;
  language: string | null;
  status: string | null;
  runtime: string | null;
  memory: string | null;
  code: string;
  /** False when this attempt was never reviewed — every analysis field below is then empty/null, never guessed. */
  reviewed: boolean;
  timeComplexity: string | null;
  spaceComplexity: string | null;
  patterns: TrackedPattern[];
  qualityScore: number | null;
  isOptimal: boolean | null;
  correctnessConcernsCount: number | null;
  improvementsCount: number | null;
  /** The AI review's own description of the approach, when reviewed. */
  approach: string | null;
}

export type StatusChange = 'fixed' | 'regressed' | 'unchanged' | 'changed';
export type ComplexityChange = 'improved' | 'regressed' | 'same' | 'unknown';

export interface ValueChange<T> {
  from: T;
  to: T;
}

export interface AttemptComparison {
  fromAttempt: number;
  toAttempt: number;
  status: ValueChange<string | null> & { change: StatusChange };
  timeComplexity: ValueChange<string | null> & { change: ComplexityChange };
  spaceComplexity: ValueChange<string | null> & { change: ComplexityChange };
  patterns: { added: TrackedPattern[]; removed: TrackedPattern[] };
  /** `null` when either attempt has no review — there is nothing to compare. */
  algorithmChanged: boolean | null;
  qualityScore: ValueChange<number | null> & { delta: number | null };
  correctnessConcerns: ValueChange<number | null> & { delta: number | null };
  /** True when the status went to Accepted, or the review's correctness concerns went down. */
  bugFixed: boolean;
  /** `null` unless both attempts have a quality score. */
  codeQualityImproved: boolean | null;
  code: {
    linesAdded: number;
    linesRemoved: number;
    languageChanged: boolean;
    identical: boolean;
  };
  reviewedBoth: boolean;
  /** Plain-English statements, each derived from a field above — never anything not backed by stored data. */
  highlights: string[];
}

export type ImprovementOutcome = 'single-attempt' | 'improved' | 'regressed' | 'no-change';

export interface ProblemHistoryOverview {
  attemptCount: number;
  firstStatus: string | null;
  finalStatus: string | null;
  finalAccepted: boolean;
  firstAcceptedAttempt: number | null;
  /** Distinct consecutive time complexities across reviewed attempts, e.g. ["O(n^2)", "O(n)"]. */
  complexityJourney: string[];
  outcome: ImprovementOutcome;
  /** "How the solution improved", one sentence per finding. */
  explanation: string[];
}

export interface ProblemHistory {
  problem: {
    number: number | null;
    slug: string;
    title: string;
    difficulty: LeetCodeDifficulty | null;
  };
  attempts: AttemptSummary[];
  /** Each attempt compared with the one before it. */
  comparisons: AttemptComparison[];
  overview: ProblemHistoryOverview;
}

export interface InsightEvidence {
  /** How many of `total` matching records show this. */
  count: number;
  total: number;
  /** A few concrete problems the claim rests on. */
  examples: Array<{ submissionId: string; title: string }>;
}

export interface LearningInsight {
  /** Stable identifier of the rule that produced this, e.g. "repeated-time-limit-exceeded". */
  id: string;
  kind: 'weakness' | 'strength';
  title: string;
  description: string;
  evidence: InsightEvidence;
}

export type PatternLevel = 'strong' | 'developing' | 'weak' | 'untouched';

export interface PatternProfile {
  pattern: TrackedPattern;
  problems: number;
  accepted: number;
  averageQuality: number | null;
  needingImprovement: number;
  level: PatternLevel;
}

export interface LearningProfile {
  problems: number;
  attempts: number;
  reviewedAttempts: number;
  /** False when there isn't enough history for recurring-weakness rules to mean anything. */
  sufficientData: boolean;
  insights: LearningInsight[];
  patterns: PatternProfile[];
  /** Honest notes about what this profile could not say. */
  notes: string[];
}

export interface Recommendation {
  pattern: TrackedPattern;
  action: 'practice' | 'review';
  reason: string;
  evidence: InsightEvidence;
}

export interface Recommendations {
  practiceMore: Recommendation[];
  review: Recommendation[];
  sufficientData: boolean;
  summary: string;
}
