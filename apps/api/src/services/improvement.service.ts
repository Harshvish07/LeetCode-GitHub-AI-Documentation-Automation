import type {
  AttemptComparison,
  LearningInsight,
  LearningProfile,
  ProblemHistory,
  Recommendations,
} from '@codereviewai/shared';
import { compareAttempts, buildProblemHistory } from '../analytics/comparison.js';
import { attemptPatterns } from '../analytics/attempts.js';
import { buildLearningProfile } from '../analytics/learningProfile.js';
import { buildRecommendations } from '../analytics/recommendations.js';
import type { LearningReader } from '../persistence/learningRepository.js';

/** Thrown when `compare` names an attempt number the problem doesn't have. */
export class AttemptNotFoundError extends Error {
  constructor(attemptNumber: number, attemptCount: number) {
    super(`Attempt ${attemptNumber} does not exist; this problem has ${attemptCount} attempt(s).`);
    this.name = 'AttemptNotFoundError';
  }
}

/** What a generated document may add for a submission; both parts are empty when there is nothing worth saying. */
export interface DocumentContext {
  history: ProblemHistory | null;
  recurringMistakes: LearningInsight[];
}

/**
 * The improvement engine's entry point: fetches stored attempts and hands
 * them to the pure functions in `analytics/` (history, comparison,
 * profile, recommendations). Like `DashboardService`, it only fetches and
 * delegates — no arithmetic of its own.
 */
export class ImprovementService {
  constructor(private readonly reader: LearningReader) {}

  /** `submissionId` may be any attempt of the problem; `null` when it matches no stored submission. */
  async getProblemHistory(submissionId: string): Promise<ProblemHistory | null> {
    const attempts = await this.reader.getProblemAttempts(submissionId);
    return attempts ? buildProblemHistory(attempts) : null;
  }

  async compare(submissionId: string, from: number, to: number): Promise<AttemptComparison | null> {
    const attempts = await this.reader.getProblemAttempts(submissionId);
    if (!attempts) return null;
    const before = attempts[from - 1];
    const after = attempts[to - 1];
    if (!before) throw new AttemptNotFoundError(from, attempts.length);
    if (!after) throw new AttemptNotFoundError(to, attempts.length);
    return compareAttempts(before, from, after, to);
  }

  /**
   * History (attempts up to and including this submission — never later
   * ones, so a document describes the moment it was written) and the weakness
   * insights relevant to it. A pattern weakness is only relevant when this
   * submission actually uses that pattern.
   */
  async getDocumentContext(submissionId: string): Promise<DocumentContext> {
    const all = await this.reader.listAttemptRecords();
    const target = all.find((attempt) => attempt.submissionId === submissionId);
    if (!target) return { history: null, recurringMistakes: [] };

    const sameProblem = all.filter((attempt) => attempt.problemId === target.problemId);
    const upToTarget = sameProblem.slice(0, sameProblem.indexOf(target) + 1);
    const history = upToTarget.length >= 2 ? buildProblemHistory(upToTarget) : null;

    const patterns = attemptPatterns(target).map((pattern) =>
      pattern.toLowerCase().replace(/s+/g, '-'),
    );
    const recurringMistakes = buildLearningProfile(all).insights.filter(
      (insight) =>
        insight.kind === 'weakness' &&
        (!insight.id.startsWith('weak-pattern-') ||
          patterns.some((pattern) => insight.id === `weak-pattern-${pattern}`)),
    );
    return { history, recurringMistakes };
  }

  async getProfile(): Promise<LearningProfile> {
    return buildLearningProfile(await this.reader.listAttemptRecords());
  }

  async getRecommendations(): Promise<Recommendations> {
    return buildRecommendations(await this.reader.listAttemptRecords());
  }
}
