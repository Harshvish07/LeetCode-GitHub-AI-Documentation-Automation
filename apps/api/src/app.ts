import cors from 'cors';
import express, { type Express } from 'express';
import type { AiProvider } from './ai/providers/types.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createApiRouter } from './routes/index.js';

export interface AppConfig {
  corsOrigin: string;
  /** Test-only override — see routes/index.ts's ApiRouterDeps for why this exists and why production never passes it. */
  aiProvider?: AiProvider;
}

export function createApp(config: AppConfig): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(requestLogger);
  app.use(express.json());
  app.use('/api', createApiRouter({ aiProvider: config.aiProvider }));

  // Must come after every route: a 404 for anything unmatched, then the
  // centralized error handler (which must keep all 4 parameters — see its
  // own comment) for anything any route/middleware passed to next(err).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
