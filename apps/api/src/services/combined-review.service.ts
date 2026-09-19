import { analyzeSolution } from '@codereviewai/analysis';
import type { StoredSubmission } from '@codereviewai/shared';
import { compareAnalyses } from '../ai/agreement.js';
import type { AiReviewService } from '../ai/ai-review.service.js';
import type { CombinedSolutionReview } from '../ai/types.js';
import { recordBestEffort } from '../persistence/bestEffort.js';
import type { LearningRecorder } from '../persistence/learningRepository.js';

/**
 * Thrown when a stored submission's code is somehow null — see the comment
 * on the guard below. Kept independent of `ApiError` (this module has no
 * Express dependency); `controllers/aiErrorMapping.ts` is the one place
 * that translates it to an HTTP-facing error.
 */
export class MissingCodeError extends Error {
  constructor() {
    super('Stored submission is missing its code.');
    this.name = 'MissingCodeError';
  }
}

/**
 * Builds a CombinedSolutionReview for an already-loaded stored submission —
 * runs Phase 4's `analyzeSolution()` fresh, calls the injected
 * `AiReviewService`, and compares the two via `compareAnalyses()`. Shared by
 * `reviews.controller.ts` (Phase 5) and `documents.controller.ts` (Phase 6)
 * so neither duplicates this orchestration, and a generated document is
 * always built from a freshly computed review, never a stale cached one.
 * When a `recorder` is given (Phase 8, database configured), the result is
 * also recorded for the dashboard — best-effort, so a database failure never
 * costs the caller a review that was already paid for.
 */
export async function buildCombinedReview(
  submission: StoredSubmission,
  reviewService: AiReviewService,
  recorder?: LearningRecorder,
): Promise<CombinedSolutionReview> {
  // submission.submission.code is typed nullable (LeetCodeSubmissionInfo is
  // also used for raw, possibly-incomplete extraction results), but a
  // *stored* submission can never actually have a null code — Phase 3's
  // createSubmissionSchema requires it. Guarded explicitly rather than
  // asserted away, so a violated invariant fails loudly instead of silently
  // passing null into the analyzer.
  if (submission.submission.code === null) {
    throw new MissingCodeError();
  }

  const deterministic = analyzeSolution({
    code: submission.submission.code,
    language: submission.submission.language,
  });

  const aiReview = await reviewService.generateReview({
    problem: submission.problem,
    submission: submission.submission,
    deterministicAnalysis: deterministic,
  });

  const agreement = compareAnalyses(deterministic, aiReview);

  const combined: CombinedSolutionReview = {
    submissionId: submission.id,
    deterministic,
    ai: aiReview,
    agreement,
    generatedAt: new Date().toISOString(),
  };

  if (recorder) {
    await recordBestEffort('review', () => recorder.recordReview(combined));
  }

  return combined;
}
