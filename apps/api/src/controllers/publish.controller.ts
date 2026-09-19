import { success, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import type { AiReviewService } from '../ai/ai-review.service.js';
import { generateDocument } from '../document/document-generator.js';
import type { GitHubPublishService, PublishResult } from '../services/github-publish.service.js';
import { recordBestEffort } from '../persistence/bestEffort.js';
import type { LearningRecorder } from '../persistence/learningRepository.js';
import { buildCombinedReview } from '../services/combined-review.service.js';
import type { SubmissionService } from '../services/submissions.service.js';
import type { PublishRequestBody } from '../schemas/publish.schema.js';
import { loadDocumentContext } from '../services/documentContext.js';
import type { ImprovementService } from '../services/improvement.service.js';
import { NotFoundError } from '../types/errors.js';
import { mapPublishErrorToApiError } from './githubErrorMapping.js';

export interface PublishControllerDeps {
  submissionService: SubmissionService;
  reviewService: AiReviewService;
  githubPublishService: GitHubPublishService;
  recorder?: LearningRecorder;
  /** Adds history/recurring-mistake sections to the document; present only when a database is configured. */
  improvement?: ImprovementService;
}

/**
 * A factory (matching reviews.controller.ts/documents.controller.ts's
 * shape) so routes/index.ts injects fresh services per createApp() call.
 * Thin by design: looks up the submission, builds the review and document
 * (reusing Phase 5/6's exact pipeline), and delegates every GitHub
 * operation — repository lookup, duplicate detection, the create/update
 * decision, file writes, index/README maintenance — to
 * `GitHubPublishService`. This file never talks to a `GitHubClient`
 * directly.
 */
export function createPublishController(deps: PublishControllerDeps) {
  return {
    publish: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        const submission = id ? await deps.submissionService.getSubmissionById(id) : null;
        if (!submission) {
          next(new NotFoundError(`No submission found with id "${String(id)}".`));
          return;
        }

        const { mode } = req.body as PublishRequestBody;

        const review = await buildCombinedReview(submission, deps.reviewService, deps.recorder);
        // The review was just recorded, so the history below already includes it.
        const context = await loadDocumentContext(deps.improvement, submission.id);
        const document = generateDocument({
          problem: submission.problem,
          submission: submission.submission,
          review,
          ...context,
        });

        const result = await deps.githubPublishService.publish({
          problem: submission.problem,
          submission: submission.submission,
          review,
          document,
          mode,
        });

        if (deps.recorder) {
          const recorder = deps.recorder;
          await recordBestEffort('publication', async () => {
            await recorder.recordDocument(submission.id, document);
            await recorder.recordPublication(submission.id, {
              path: result.path,
              documentUrl: result.documentUrl,
              commitUrl: result.commitUrl,
              publishedAt: new Date().toISOString(),
            });
          });
        }

        const body: ApiResponse<PublishResult> = success(result);
        res.status(200).json(body);
      } catch (error) {
        next(mapPublishErrorToApiError(error));
      }
    },
  };
}
