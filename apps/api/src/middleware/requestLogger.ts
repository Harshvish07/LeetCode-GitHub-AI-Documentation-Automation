import type { NextFunction, Request, Response } from 'express';

/**
 * A lightweight, dependency-free dev-time request logger. Logs after the
 * response finishes (not before) so the logged status code and duration
 * reflect what actually happened, including requests that ended in an
 * error handled by errorHandler. Swap for a structured logger (pino,
 * winston) before this ever runs somewhere log volume/format matters.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
}
