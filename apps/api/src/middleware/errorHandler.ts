import { failure, type ApiResponse } from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../types/errors.js';

/**
 * The single place any error thrown/passed-to-next() anywhere in the app
 * becomes an HTTP response. Must be registered last (after every route) and
 * keep all four parameters — Express only recognizes a middleware function
 * as an error handler when its arity is exactly 4.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    const body: ApiResponse<never> = failure(err.message, err.code, err.details);
    res.status(err.statusCode).json(body);
    return;
  }

  // express.json() rejects malformed JSON with a SyntaxError carrying status 400.
  if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
    const body: ApiResponse<never> = failure('Malformed JSON in request body', 'MALFORMED_JSON');
    res.status(400).json(body);
    return;
  }

  console.error('[api] unhandled error:', err);
  const body: ApiResponse<never> = failure('Internal server error', 'INTERNAL_ERROR');
  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiResponse<never> = failure(
    `Route not found: ${req.method} ${req.originalUrl}`,
    'NOT_FOUND',
  );
  res.status(404).json(body);
}
