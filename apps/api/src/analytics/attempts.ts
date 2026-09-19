import type { LeetCodeDifficulty, TrackedPattern } from '@codereviewai/shared';
import { normalizePatterns } from './patterns.js';

/**
 * One submission of one problem as the improvement engine sees it: the
 * submission's own columns plus, when it was reviewed, the extracted
 * analysis/review fields (all `null`/empty otherwise — an unreviewed
 * attempt contributes its status and code, and nothing else). Produced by
 * the repository; consumed only by the pure functions in `analytics/`.
 */
export interface AttemptRecord {
  submissionId: string;
  problemId: string;
  number: number | null;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  language: string | null;
  code: string;
  status: string | null;
  runtime: string | null;
  memory: string | null;
  submittedAt: string;
  reviewed: boolean;
  staticPatterns: string[];
  aiPatterns: string[];
  staticTimeComplexity: string | null;
  aiTimeComplexity: string | null;
  staticSpaceComplexity: string | null;
  aiSpaceComplexity: string | null;
  qualityScore: number | null;
  isOptimal: boolean | null;
  correctnessConcernsCount: number | null;
  improvementsCount: number | null;
  /** The AI's correctness-concern sentences, verbatim. */
  correctnessConcerns: string[];
  approach: string | null;
  /** The AI's proposed better approach, when it gave one. */
  betterApproachDescription: string | null;
  betterApproachTimeComplexity: string | null;
}

export const ACCEPTED = 'Accepted';

/** Patterns for one attempt: static + AI, normalized. Empty for an unreviewed attempt. */
export function attemptPatterns(attempt: AttemptRecord): TrackedPattern[] {
  return normalizePatterns([...attempt.staticPatterns, ...attempt.aiPatterns]);
}

/** The AI's complexity wins over the static estimate (same rule as the dashboard). */
export function attemptTime(attempt: AttemptRecord): string | null {
  return attempt.aiTimeComplexity ?? attempt.staticTimeComplexity;
}

export function attemptSpace(attempt: AttemptRecord): string | null {
  return attempt.aiSpaceComplexity ?? attempt.staticSpaceComplexity;
}

/** Groups attempts by problem, each group in attempt order (oldest first). Group order follows first appearance. */
export function groupByProblem(attempts: AttemptRecord[]): AttemptRecord[][] {
  const groups = new Map<string, AttemptRecord[]>();
  for (const attempt of attempts) {
    const group = groups.get(attempt.problemId);
    if (group) group.push(attempt);
    else groups.set(attempt.problemId, [attempt]);
  }
  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)),
  );
}
