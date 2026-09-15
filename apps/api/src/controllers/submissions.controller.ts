import { success, type ApiResponse, type StoredSubmission } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import type { ValidatedSubmissionInput } from '../schemas/submission.schema.js';
import type { SubmissionService } from '../services/submissions.service.js';

/**
 * A factory (rather than a module-level object) so routes/index.ts can
 * inject a SubmissionService built from a fresh repository per createApp()
 * call — the same dependency-injection shape app.ts already uses for the
 * Express app itself, which is what lets tests get an isolated in-memory
 * store per test run instead of leaking state between them.
 */
export function createSubmissionsController(service: SubmissionService) {
  return {
    createSubmission: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Safe: middleware/validateBody.ts already ran createSubmissionSchema
        // against req.body and replaced it with the parsed result.
        const input = req.body as ValidatedSubmissionInput;
        const submission = await service.createSubmission(input);

        const body: ApiResponse<StoredSubmission> = success(submission);
        res.status(201).json(body);
      } catch (error) {
        next(error);
      }
    },
  };
}
