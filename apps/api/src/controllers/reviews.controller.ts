import { analyzeSolution } from '@codereviewai/analysis';
import { success, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import { compareAnalyses } from '../ai/agreement.js';
import type { AiReviewService } from '../ai/ai-review.service.js';
import { AiReviewError } from '../ai/errors.js';
import type { CombinedSolutionReview } from '../ai/types.js';
import type { SubmissionService } from '../services/submissions.service.js';
import { ApiError, NotFoundError } from '../types/errors.js';

export interface ReviewsControllerDeps {
  submissionService: SubmissionService;
  reviewService: AiReviewService;
}

/**
 * A factory (matching submissions.controller.ts's shape) so routes/index.ts
 * injects a fresh SubmissionService/AiReviewService per createApp() call.
 */
export function createReviewsController(deps: ReviewsControllerDeps) {
  return {
    generateReview: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        const submission = id ? await deps.submissionService.getSubmissionById(id) : null;
        if (!submission) {
          next(new NotFoundError(`No submission found with id "${String(id)}".`));
          return;
        }

        // submission.code is typed nullable (LeetCodeSubmissionInfo is also
        // used for raw, possibly-incomplete extraction results), but a
        // *stored* submission can never actually have a null code — Phase 3's
        // createSubmissionSchema requires it. Guarded explicitly rather than
        // asserted away, so a violated invariant fails loudly instead of
        // silently passing `null` into the analyzer.
        if (submission.submission.code === null) {
          next(new ApiError(500, 'INTERNAL_ERROR', 'Stored submission is missing its code.'));
          return;
        }

        // The deterministic analysis is always recomputed fresh from the
        // stored code, never cached — packages/analysis is pure and cheap,
        // and recomputing avoids ever serving a stale analysis if that
        // package's heuristics improve after a submission was stored.
        const deterministic = analyzeSolution({
          code: submission.submission.code,
          language: submission.submission.language,
        });

        const aiReview = await deps.reviewService.generateReview({
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

        const body: ApiResponse<CombinedSolutionReview> = success(combined);
        res.status(200).json(body);
      } catch (error) {
        next(toApiError(error));
      }
    },
  };
}

/** Translates the ai/ module's HTTP-agnostic AiReviewError into the HTTP-facing ApiError the centralized error handler understands. */
function toApiError(error: unknown): unknown {
  if (!(error instanceof AiReviewError)) return error;

  switch (error.code) {
    case 'TIMEOUT':
      return new ApiError(504, 'AI_TIMEOUT', error.message);
    case 'RATE_LIMITED':
      return new ApiError(429, 'AI_RATE_LIMITED', error.message);
    case 'MALFORMED_RESPONSE':
      return new ApiError(502, 'AI_MALFORMED_RESPONSE', error.message);
    case 'SCHEMA_VALIDATION_FAILED':
      return new ApiError(502, 'AI_INVALID_RESPONSE', error.message);
    case 'PROVIDER_ERROR':
    default:
      return new ApiError(502, 'AI_PROVIDER_ERROR', error.message);
  }
}
