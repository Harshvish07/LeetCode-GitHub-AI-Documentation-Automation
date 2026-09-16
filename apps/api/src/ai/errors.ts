/**
 * Errors specific to the AI review pipeline, deliberately independent of
 * Express/HTTP (this module has no `res.status()` concept) — the
 * controller that eventually calls into this layer is responsible for
 * mapping an AiReviewError to an ApiError (see
 * controllers/reviews.controller.ts). Every failure mode the task calls out
 * — timeout, malformed response, provider error, rate limit, invalid
 * response, missing fields — maps to exactly one of these codes; "invalid
 * response" and "missing fields" both surface as SCHEMA_VALIDATION_FAILED,
 * since both are just Zod rejecting the parsed JSON for different reasons.
 */
export type AiReviewErrorCode =
  'TIMEOUT' | 'PROVIDER_ERROR' | 'RATE_LIMITED' | 'MALFORMED_RESPONSE' | 'SCHEMA_VALIDATION_FAILED';

export class AiReviewError extends Error {
  public readonly code: AiReviewErrorCode;
  public override readonly cause?: unknown;

  constructor(code: AiReviewErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AiReviewError';
    this.code = code;
    this.cause = cause;
  }
}
