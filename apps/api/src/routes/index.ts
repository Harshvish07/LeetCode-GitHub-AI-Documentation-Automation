import { Router } from 'express';
import type { AiProvider } from '../ai/providers/types.js';
import { AiReviewService } from '../ai/ai-review.service.js';
import { createProviderFromEnv } from '../ai/providers/createProviderFromEnv.js';
import { createImprovementController } from '../controllers/improvement.controller.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { createDocumentsController } from '../controllers/documents.controller.js';
import { createPublishController } from '../controllers/publish.controller.js';
import { createReviewsController } from '../controllers/reviews.controller.js';
import { createSubmissionsController } from '../controllers/submissions.controller.js';
import { createGitHubClientFromEnv } from '../github/createGitHubClientFromEnv.js';
import type { GitHubClient } from '../github/types.js';
import type { Database } from '../persistence/database.js';
import type { LearningReader, LearningRecorder } from '../persistence/learningRepository.js';
import { PostgresLearningRepository } from '../persistence/postgresLearningRepository.js';
import { PostgresSubmissionRepository } from '../persistence/postgresSubmissionRepository.js';
import { createUnavailableLearningReader } from '../persistence/unavailableLearningReader.js';
import {
  InMemorySubmissionRepository,
  type SubmissionRepository,
} from '../repositories/submissions.repository.js';
import { DashboardService } from '../services/dashboard.service.js';
import { ImprovementService } from '../services/improvement.service.js';
import { GitHubPublishService } from '../services/github-publish.service.js';
import { SubmissionService } from '../services/submissions.service.js';
import { createDashboardRouter } from './dashboard.route.js';
import { createDocumentsRouter } from './documents.route.js';
import { healthRouter } from './health.route.js';
import { createImprovementRouter } from './improvement.route.js';
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
  /**
   * The Postgres database (Phase 8). `index.ts` builds it from DATABASE_URL and
   * runs migrations; tests inject a PGlite database. When omitted, submissions
   * stay in memory, nothing is recorded, and the dashboard endpoints answer
   * `503 DATABASE_NOT_CONFIGURED` — the API works exactly as it did before
   * Phase 8.
   */
  database?: Database;
  /** Test-only: pins "today" for streak calculations. */
  now?: () => Date;
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

  let repository: SubmissionRepository;
  let recorder: LearningRecorder | undefined;
  let reader: LearningReader;
  if (deps.database) {
    const learning = new PostgresLearningRepository(deps.database);
    repository = new PostgresSubmissionRepository(deps.database);
    recorder = learning;
    reader = learning;
  } else {
    repository = new InMemorySubmissionRepository();
    reader = createUnavailableLearningReader();
  }
  const improvement = new ImprovementService(reader);
  const submissionService = new SubmissionService(repository);
  const submissionsController = createSubmissionsController(submissionService);
  router.use(createSubmissionsRouter(submissionsController));

  const aiProvider = deps.aiProvider ?? createProviderFromEnv();
  const reviewService = new AiReviewService(aiProvider);
  const reviewsController = createReviewsController({ submissionService, reviewService, recorder });
  router.use(createReviewsRouter(reviewsController));

  const documentsController = createDocumentsController({
    submissionService,
    reviewService,
    recorder,
    improvement: deps.database ? improvement : undefined,
  });
  router.use(createDocumentsRouter(documentsController));

  const githubClient = deps.githubClient ?? createGitHubClientFromEnv();
  const githubPublishService = new GitHubPublishService(githubClient);
  const publishController = createPublishController({
    submissionService,
    reviewService,
    githubPublishService,
    recorder,
    improvement: deps.database ? improvement : undefined,
  });
  router.use(createPublishRouter(publishController));

  const dashboardController = createDashboardController(new DashboardService(reader, deps.now));
  router.use(createDashboardRouter(dashboardController));
  router.use(createImprovementRouter(createImprovementController(improvement)));

  return router;
}
