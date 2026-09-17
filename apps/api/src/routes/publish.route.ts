import { Router } from 'express';
import type { createPublishController } from '../controllers/publish.controller.js';
import { validateBody } from '../middleware/validateBody.js';
import { publishRequestSchema } from '../schemas/publish.schema.js';

export function createPublishRouter(
  controller: ReturnType<typeof createPublishController>,
): Router {
  const router = Router();

  router.post('/submissions/:id/publish', validateBody(publishRequestSchema), controller.publish);

  return router;
}
