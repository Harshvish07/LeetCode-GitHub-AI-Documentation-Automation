import { Router } from 'express';
import { createSubmissionsController } from '../controllers/submissions.controller.js';
import { InMemorySubmissionRepository } from '../repositories/submissions.repository.js';
import { SubmissionService } from '../services/submissions.service.js';
import { healthRouter } from './health.route.js';
import { createSubmissionsRouter } from './submissions.route.js';

/**
 * A factory, not a module-level singleton: called fresh inside createApp()
 * (apps/api/src/app.ts) each time, so every app instance — and every test
 * that builds its own app via createApp() — gets its own in-memory
 * submission store instead of sharing state across instances.
 */
export function createApiRouter(): Router {
  const router = Router();

  router.use(healthRouter);

  const repository = new InMemorySubmissionRepository();
  const service = new SubmissionService(repository);
  const submissionsController = createSubmissionsController(service);
  router.use(createSubmissionsRouter(submissionsController));

  return router;
}
