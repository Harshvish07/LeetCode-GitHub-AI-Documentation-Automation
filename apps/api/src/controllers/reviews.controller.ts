import { success, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import type { AiReviewService } from '../ai/ai-review.service.js';
import type { CombinedSolutionReview } from '../ai/types.js';
import type { SubmissionService } from '../services/submissions.service.js';
import { buildCombinedReview } from '../services/combined-review.service.js';
import { NotFoundError } from '../types/errors.js';
import { mapAiErrorToApiError } from './aiErrorMapping.js';

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

        const combined = await buildCombinedReview(submission, deps.reviewService);

        const body: ApiResponse<CombinedSolutionReview> = success(combined);
        res.status(200).json(body);
      } catch (error) {
        next(mapAiErrorToApiError(error));
      }
    },
  };
}
