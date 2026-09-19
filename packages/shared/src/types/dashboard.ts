import type { LeetCodeDifficulty } from './leetcode.js';

/**
 * The wire contract for the Phase 8 dashboard API (`/api/dashboard/*` and
 * `/api/problems*`). These are hand-written DTOs — not re-exports of
 * `apps/api`'s internal types — so `apps/web` can depend on them without
 * importing anything from the server; `apps/api` assigns its own richer
 * types to these, so TypeScript fails to compile if the two ever drift.
 */

/** The patterns the dashboard tracks, in display order. */
export const TRACKED_PATTERNS = [
  'Hash Map',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Stack',
  'Queue',
  'BFS',
  'DFS',
  'Heap',
  'Greedy',
  'Backtracking',
  'Dynamic Programming',
  'Graph',
  'Tree',
  'Prefix Sum',
  'Sorting',
] as const;

export type TrackedPattern = (typeof TRACKED_PATTERNS)[number];

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** One row of the problem list — the latest submission for one problem. */
export interface ProblemListItem {
  submissionId: string;
  problemId: string;
  number: number | null;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  /** Tracked patterns (normalized) found by static analysis and/or the AI review. */
  patterns: TrackedPattern[];
  language: string | null;
  status: string | null;
  /** The AI's time-complexity assessment, or the static estimate if there's no review. */
  timeComplexity: string | null;
  /** 0-100, or null when the submission has no AI review yet. */
  qualityScore: number | null;
  isOptimal: boolean | null;
  reviewed: boolean;
  submittedAt: string;
  githubUrl: string | null;
}

export interface DifficultyDistribution {
  Easy: number;
  Medium: number;
  Hard: number;
  Unknown: number;
}

export interface DashboardSummary {
  /** Distinct problems recorded (each counted once, by its latest submission). */
  totalProblems: number;
  /** Problems whose latest submission was Accepted. */
  acceptedSolutions: number;
  /** Reviewed solutions that are not optimal, or have correctness concerns. */
  needingImprovement: number;
  /** Reviewed solutions the AI judged asymptotically optimal. */
  optimalSolutions: number;
  /** Submissions recorded but not yet AI-reviewed. */
  unreviewed: number;
  /** Consecutive days (UTC) with at least one submission, ending today or yesterday. */
  currentStreak: number;
  longestStreak: number;
  patternsPracticed: number;
  difficultyDistribution: DifficultyDistribution;
  recentProblems: ProblemListItem[];
}

export interface PatternStat {
  pattern: TrackedPattern;
  solved: number;
  /** Mean quality score of the reviewed solutions using this pattern, or null if none reviewed. */
  averageQuality: number | null;
  /** How many of these solutions need improvement (not optimal / correctness concerns). */
  improvementOpportunities: number;
  /** Up to three problems most worth revisiting for this pattern. */
  revisit: Array<{ submissionId: string; title: string }>;
}

export type ProblemSortKey =
  'number' | 'title' | 'difficulty' | 'language' | 'status' | 'complexity' | 'quality' | 'date';

export type SortOrder = 'asc' | 'desc';

export interface ProblemListQuery {
  /** Case-insensitive match against title, slug, number, and pattern names. */
  search?: string;
  difficulty?: LeetCodeDifficulty;
  pattern?: TrackedPattern;
  status?: string;
  language?: string;
  sortBy?: ProblemSortKey;
  sortOrder?: SortOrder;
}

export interface ReviewAgreementDetail {
  time: { matches: boolean; deterministic: string; ai: string };
  space: { matches: boolean; deterministic: string; ai: string };
  patternsAgreedOn: string[];
  patternsOnlyInDeterministic: string[];
  patternsOnlyInAi: string[];
  hasDisagreement: boolean;
}

export interface AnalysisDetail {
  patterns: Array<{ pattern: string; confidence: ConfidenceLevel }>;
  timeComplexity: { notation: string; confidence: ConfidenceLevel };
  spaceComplexity: { notation: string; confidence: ConfidenceLevel };
  confidence: ConfidenceLevel;
  possibleIssues: Array<{ message: string; severity: 'info' | 'warning' }>;
  codeQualityObservations: Array<{ message: string; severity: 'info' | 'warning' }>;
  edgeCaseObservations: Array<{ concern: string; detail: string; severity: 'info' | 'warning' }>;
}

export interface BetterApproachDetail {
  description: string;
  pseudocode: string;
  code: string;
  complexity: { time: string; space: string };
  whyBetter: string;
}

export interface ReviewDetail {
  problemSummary: string;
  userApproach: string;
  patterns: string[];
  whyItWorks: string;
  complexity: { time: string; space: string };
  strengths: string[];
  improvements: string[];
  correctnessConcerns: string[];
  edgeCases: string[];
  optimality: { isOptimal: boolean; reasoning: string };
  betterApproach: BetterApproachDetail | null;
  alternativeApproaches: string[];
  learningPoints: string[];
  relatedPatterns: string[];
  confidence: ConfidenceLevel;
  agreement: ReviewAgreementDetail;
}

export interface ProblemDetail {
  submissionId: string;
  problem: {
    number: number | null;
    slug: string;
    title: string;
    difficulty: LeetCodeDifficulty | null;
    url: string;
    description: string | null;
  };
  submission: {
    language: string | null;
    code: string;
    status: string | null;
    runtime: string | null;
    memory: string | null;
    submittedAt: string;
  };
  analysis: AnalysisDetail | null;
  review: ReviewDetail | null;
  qualityScore: number | null;
  document: {
    filename: string;
    githubUrl: string | null;
    publishedAt: string | null;
  } | null;
}
