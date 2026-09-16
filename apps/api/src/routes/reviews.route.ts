import { Router } from 'express';
import type { createReviewsController } from '../controllers/reviews.controller.js';

export function createReviewsRouter(
  controller: ReturnType<typeof createReviewsController>,
): Router {
  const router = Router();

  router.post('/submissions/:id/review', controller.generateReview);

  return router;
}
