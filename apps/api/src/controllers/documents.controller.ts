import { success, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import { generateDocument } from '../document/document-generator.js';
import type { GeneratedDocument } from '../document/types.js';
import type { AiReviewService } from '../ai/ai-review.service.js';
import type { SubmissionService } from '../services/submissions.service.js';
import { buildCombinedReview } from '../services/combined-review.service.js';
import { NotFoundError } from '../types/errors.js';
import { mapAiErrorToApiError } from './aiErrorMapping.js';

export interface DocumentsControllerDeps {
  submissionService: SubmissionService;
  reviewService: AiReviewService;
}

/**
 * A factory (matching reviews.controller.ts's shape) so routes/index.ts
 * injects a fresh SubmissionService/AiReviewService per createApp() call.
 * Thin by design: looks up the submission, delegates the review to
 * buildCombinedReview() (shared with reviews.controller.ts), and delegates
 * all Markdown rendering to document/document-generator.ts — this file
 * never builds Markdown itself.
 */
export function createDocumentsController(deps: DocumentsControllerDeps) {
  return {
    generateDocument: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        const submission = id ? await deps.submissionService.getSubmissionById(id) : null;
        if (!submission) {
          next(new NotFoundError(`No submission found with id "${String(id)}".`));
          return;
        }

        const review = await buildCombinedReview(submission, deps.reviewService);
        const document = generateDocument({
          problem: submission.problem,
          submission: submission.submission,
          review,
        });

        const body: ApiResponse<GeneratedDocument> = success(document);
        res.status(200).json(body);
      } catch (error) {
        next(mapAiErrorToApiError(error));
      }
    },
  };
}
