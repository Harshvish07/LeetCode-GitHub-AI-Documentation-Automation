import { Router } from 'express';
import type { createSubmissionsController } from '../controllers/submissions.controller.js';
import { validateBody } from '../middleware/validateBody.js';
import { createSubmissionSchema } from '../schemas/submission.schema.js';

export function createSubmissionsRouter(
  controller: ReturnType<typeof createSubmissionsController>,
): Router {
  const router = Router();

  router.post('/submissions', validateBody(createSubmissionSchema), controller.createSubmission);

  return router;
}
