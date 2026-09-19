import { success, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import { generateDocument } from '../document/document-generator.js';
import type { GeneratedDocument } from '../document/types.js';
import type { AiReviewService } from '../ai/ai-review.service.js';
import type { SubmissionService } from '../services/submissions.service.js';
import { recordBestEffort } from '../persistence/bestEffort.js';
import type { LearningRecorder } from '../persistence/learningRepository.js';
import { buildCombinedReview } from '../services/combined-review.service.js';
import { loadDocumentContext } from '../services/documentContext.js';
import type { ImprovementService } from '../services/improvement.service.js';
import { NotFoundError } from '../types/errors.js';
import { mapAiErrorToApiError } from './aiErrorMapping.js';

export interface DocumentsControllerDeps {
  submissionService: SubmissionService;
  reviewService: AiReviewService;
  recorder?: LearningRecorder;
  /** Adds history/recurring-mistake sections to the document; present only when a database is configured. */
  improvement?: ImprovementService;
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

        const review = await buildCombinedReview(submission, deps.reviewService, deps.recorder);
        // The review was just recorded, so the history below already includes it.
        const context = await loadDocumentContext(deps.improvement, submission.id);
        const document = generateDocument({
          problem: submission.problem,
          submission: submission.submission,
          review,
          ...context,
        });

        if (deps.recorder) {
          const recorder = deps.recorder;
          await recordBestEffort('document', () =>
            recorder.recordDocument(submission.id, document),
          );
        }

        const body: ApiResponse<GeneratedDocument> = success(document);
        res.status(200).json(body);
      } catch (error) {
        next(mapAiErrorToApiError(error));
      }
    },
  };
}
