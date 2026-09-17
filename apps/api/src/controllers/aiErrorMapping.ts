import { AiReviewError } from '../ai/errors.js';
import { MissingCodeError } from '../services/combined-review.service.js';
import { ApiError } from '../types/errors.js';

/**
 * Translates errors that can come out of `buildCombinedReview()` — the ai/
 * module's HTTP-agnostic `AiReviewError`, or `combined-review.service.ts`'s
 * `MissingCodeError` — into the HTTP-facing `ApiError` the centralized error
 * handler understands. Shared by `reviews.controller.ts` (Phase 5) and
 * `documents.controller.ts` (Phase 6) so both endpoints report the same
 * failure the same way.
 */
export function mapAiErrorToApiError(error: unknown): unknown {
  if (error instanceof MissingCodeError) {
    return new ApiError(500, 'INTERNAL_ERROR', error.message);
  }
  if (!(error instanceof AiReviewError)) return error;

  switch (error.code) {
    case 'TIMEOUT':
      return new ApiError(504, 'AI_TIMEOUT', error.message);
    case 'RATE_LIMITED':
      return new ApiError(429, 'AI_RATE_LIMITED', error.message);
    case 'MALFORMED_RESPONSE':
      return new ApiError(502, 'AI_MALFORMED_RESPONSE', error.message);
    case 'SCHEMA_VALIDATION_FAILED':
      return new ApiError(502, 'AI_INVALID_RESPONSE', error.message);
    case 'PROVIDER_ERROR':
    default:
      return new ApiError(502, 'AI_PROVIDER_ERROR', error.message);
  }
}
