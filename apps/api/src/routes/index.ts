import { Router } from 'express';
import type { AiProvider } from '../ai/providers/types.js';
import { AiReviewService } from '../ai/ai-review.service.js';
import { createProviderFromEnv } from '../ai/providers/createProviderFromEnv.js';
import { createDocumentsController } from '../controllers/documents.controller.js';
import { createPublishController } from '../controllers/publish.controller.js';
import { createReviewsController } from '../controllers/reviews.controller.js';
import { createSubmissionsController } from '../controllers/submissions.controller.js';
import { createGitHubClientFromEnv } from '../github/createGitHubClientFromEnv.js';
import type { GitHubClient } from '../github/types.js';
import { InMemorySubmissionRepository } from '../repositories/submissions.repository.js';
import { GitHubPublishService } from '../services/github-publish.service.js';
import { SubmissionService } from '../services/submissions.service.js';
import { createDocumentsRouter } from './documents.route.js';
import { healthRouter } from './health.route.js';
import { createPublishRouter } from './publish.route.js';
import { createReviewsRouter } from './reviews.route.js';
import { createSubmissionsRouter } from './submissions.route.js';

export interface ApiRouterDeps {
  /**
   * Overrides the real provider (Anthropic or Gemini, selected via
   * AI_PROVIDER — see ai/providers/createProviderFromEnv.ts) — exists purely
   * so tests can inject a mock (never a real network call; see
   * ai/providers/mockProvider.ts) without needing an AI_PROVIDER_API_KEY.
   * Production code (app.ts) never passes this, so it always gets the real
   * provider built from env vars.
   */
  aiProvider?: AiProvider;
  /**
   * Overrides the real GitHub client — exists purely so tests can inject a
   * mock (never a real network call; see github/mockGitHubClient.ts)
   * without needing GITHUB_TOKEN/GITHUB_REPO. Production code (app.ts)
   * never passes this, so it always gets the real client built from env
   * vars via github/createGitHubClientFromEnv.ts.
   */
  githubClient?: GitHubClient;
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

  const aiProvider = deps.aiProvider ?? createProviderFromEnv();
  const reviewService = new AiReviewService(aiProvider);
  const reviewsController = createReviewsController({ submissionService, reviewService });
  router.use(createReviewsRouter(reviewsController));

  const documentsController = createDocumentsController({ submissionService, reviewService });
  router.use(createDocumentsRouter(documentsController));

  const githubClient = deps.githubClient ?? createGitHubClientFromEnv();
  const githubPublishService = new GitHubPublishService(githubClient);
  const publishController = createPublishController({
    submissionService,
    reviewService,
    githubPublishService,
  });
  router.use(createPublishRouter(publishController));

  return router;
}
