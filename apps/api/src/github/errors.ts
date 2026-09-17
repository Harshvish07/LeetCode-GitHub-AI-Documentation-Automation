/**
 * Errors specific to the GitHub publishing pipeline, deliberately independent
 * of Express/HTTP (this module has no `res.status()` concept) — mirrors
 * `ai/errors.ts`'s `AiReviewError` exactly, for the same reason: the
 * controller that eventually calls into this layer
 * (`controllers/publish.controller.ts`) is the one place responsible for
 * mapping a `GitHubError` to an `ApiError` (see
 * `controllers/githubErrorMapping.ts`). Every failure mode the task calls
 * out — authentication failure, API errors, and a detected duplicate the
 * caller didn't explicitly ask to overwrite — maps to exactly one of these
 * codes.
 */
export type GitHubErrorCode =
  'AUTH_FAILED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'CONFLICT' | 'API_ERROR';

export class GitHubError extends Error {
  public readonly code: GitHubErrorCode;
  public override readonly cause?: unknown;

  constructor(code: GitHubErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
    this.cause = cause;
  }
}
