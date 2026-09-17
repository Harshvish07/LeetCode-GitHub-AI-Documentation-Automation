import { success, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import type { AiReviewService } from '../ai/ai-review.service.js';
import { generateDocument } from '../document/document-generator.js';
import type { GitHubPublishService, PublishResult } from '../services/github-publish.service.js';
import { buildCombinedReview } from '../services/combined-review.service.js';
import type { SubmissionService } from '../services/submissions.service.js';
import type { PublishRequestBody } from '../schemas/publish.schema.js';
import { NotFoundError } from '../types/errors.js';
import { mapPublishErrorToApiError } from './githubErrorMapping.js';

export interface PublishControllerDeps {
  submissionService: SubmissionService;
  reviewService: AiReviewService;
  githubPublishService: GitHubPublishService;
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

        const review = await buildCombinedReview(submission, deps.reviewService);
        const document = generateDocument({
          problem: submission.problem,
          submission: submission.submission,
          review,
        });

        const result = await deps.githubPublishService.publish({
          problem: submission.problem,
          submission: submission.submission,
          review,
          document,
          mode,
        });

        const body: ApiResponse<PublishResult> = success(result);
        res.status(200).json(body);
      } catch (error) {
        next(mapPublishErrorToApiError(error));
      }
    },
  };
}
