import { Router } from 'express';
import type { createDocumentsController } from '../controllers/documents.controller.js';

export function createDocumentsRouter(
  controller: ReturnType<typeof createDocumentsController>,
): Router {
  const router = Router();

  router.post('/submissions/:id/document', controller.generateDocument);

  return router;
}
