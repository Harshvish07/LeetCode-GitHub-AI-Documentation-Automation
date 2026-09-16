import { Router } from 'express';
import type { AiProvider } from '../ai/providers/types.js';
import { AiReviewService } from '../ai/ai-review.service.js';
import { createAnthropicProvider } from '../ai/providers/anthropicProvider.js';
import { createReviewsController } from '../controllers/reviews.controller.js';
import { createSubmissionsController } from '../controllers/submissions.controller.js';
import { InMemorySubmissionRepository } from '../repositories/submissions.repository.js';
import { SubmissionService } from '../services/submissions.service.js';
import { healthRouter } from './health.route.js';
import { createReviewsRouter } from './reviews.route.js';
import { createSubmissionsRouter } from './submissions.route.js';

export interface ApiRouterDeps {
  /**
   * Overrides the real Anthropic provider — exists purely so tests can
   * inject a mock (never a real network call; see ai/providers/mockProvider.ts)
   * without needing an AI_PROVIDER_API_KEY. Production code (app.ts) never
   * passes this, so it always gets the real provider built from env vars.
   */
  aiProvider?: AiProvider;
}

/**
 * A factory, not a module-level singleton: called fresh inside createApp()
 * (apps/api/src/app.ts) each time, so every app instance — and every test
 * that builds its own app via createApp() — gets its own in-memory
 * submission store instead of sharing state across instances.
 */
export function createApiRouter(deps: ApiRouterDeps = {}): Router {
  const router = Router();

  router.use(healthRouter);

  const repository = new InMemorySubmissionRepository();
  const submissionService = new SubmissionService(repository);
  const submissionsController = createSubmissionsController(submissionService);
  router.use(createSubmissionsRouter(submissionsController));

  const aiProvider =
    deps.aiProvider ??
    createAnthropicProvider({
      apiKey: process.env.AI_PROVIDER_API_KEY,
      model: process.env.AI_PROVIDER_MODEL ?? 'claude-sonnet-5',
    });
  const reviewService = new AiReviewService(aiProvider);
  const reviewsController = createReviewsController({ submissionService, reviewService });
  router.use(createReviewsRouter(reviewsController));

  return router;
}
