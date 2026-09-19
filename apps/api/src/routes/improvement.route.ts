import { Router } from 'express';
import type { createImprovementController } from '../controllers/improvement.controller.js';

export function createImprovementRouter(
  controller: ReturnType<typeof createImprovementController>,
): Router {
  const router = Router();

  router.get('/problems/:id/history', controller.getHistory);
  router.get('/problems/:id/compare', controller.compare);
  router.get('/learning/profile', controller.getProfile);
  router.get('/learning/recommendations', controller.getRecommendations);

  return router;
}
