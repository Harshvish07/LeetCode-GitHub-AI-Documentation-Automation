import { ApiError } from '../types/errors.js';
import type { LearningReader } from './learningRepository.js';

/**
 * The `LearningReader` used when `DATABASE_URL` isn't configured: every
 * dashboard endpoint answers a clear `503 DATABASE_NOT_CONFIGURED` instead
 * of the route vanishing into a generic 404 — the same "fail clearly, never
 * crash" posture as a missing AI key or GitHub token.
 */
export function createUnavailableLearningReader(): LearningReader {
  const unavailable = (): Promise<never> =>
    Promise.reject(
      new ApiError(
        503,
        'DATABASE_NOT_CONFIGURED',
        'The dashboard needs a database: set DATABASE_URL and restart the API. See docs/database.md.',
      ),
    );
  return {
    listProblemRecords: unavailable,
    listActivityDates: unavailable,
    getProblemDetail: unavailable,
    listAttemptRecords: unavailable,
    getProblemAttempts: unavailable,
  };
}
