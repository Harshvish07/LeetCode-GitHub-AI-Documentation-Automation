import { Router } from 'express';
import type { createDashboardController } from '../controllers/dashboard.controller.js';

export function createDashboardRouter(
  controller: ReturnType<typeof createDashboardController>,
): Router {
  const router = Router();

  router.get('/dashboard/summary', controller.getSummary);
  router.get('/dashboard/patterns', controller.getPatterns);
  router.get('/problems', controller.listProblems);
  router.get('/problems/:id', controller.getProblem);

  return router;
}
