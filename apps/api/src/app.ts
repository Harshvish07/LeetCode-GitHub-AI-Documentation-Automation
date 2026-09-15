import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createApiRouter } from './routes/index.js';

export interface AppConfig {
  corsOrigin: string;
}

export function createApp(config: AppConfig): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(requestLogger);
  app.use(express.json());
  app.use('/api', createApiRouter());

  // Must come after every route: a 404 for anything unmatched, then the
  // centralized error handler (which must keep all 4 parameters — see its
  // own comment) for anything any route/middleware passed to next(err).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
