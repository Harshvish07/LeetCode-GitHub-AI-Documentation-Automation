import { GitHubError } from '../github/errors.js';
import { ApiError } from '../types/errors.js';
import { mapAiErrorToApiError } from './aiErrorMapping.js';

/**
 * Translates a `GitHubError` (`github/errors.ts`) into the HTTP-facing
 * `ApiError` the centralized error handler understands — the GitHub
 * counterpart to `aiErrorMapping.ts`'s `mapAiErrorToApiError()`, used the
 * same way by `controllers/publish.controller.ts`. Falls through to
 * `mapAiErrorToApiError()` for anything that isn't a `GitHubError`, since
 * publishing also runs the exact same AI-review pipeline
 * (`buildCombinedReview()`) the review/document endpoints do, and can fail
 * for any of their reasons too (timeout, malformed response, missing
 * code, ...).
 */
export function mapPublishErrorToApiError(error: unknown): unknown {
  if (error instanceof GitHubError) {
    switch (error.code) {
      case 'AUTH_FAILED':
        return new ApiError(502, 'GITHUB_AUTH_FAILED', error.message);
      case 'NOT_FOUND':
        return new ApiError(404, 'GITHUB_NOT_FOUND', error.message);
      case 'RATE_LIMITED':
        return new ApiError(429, 'GITHUB_RATE_LIMITED', error.message);
      case 'CONFLICT':
        return new ApiError(409, 'GITHUB_CONFLICT', error.message);
      case 'API_ERROR':
      default:
        return new ApiError(502, 'GITHUB_API_ERROR', error.message);
    }
  }

  return mapAiErrorToApiError(error);
}
