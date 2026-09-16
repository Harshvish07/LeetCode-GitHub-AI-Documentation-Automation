/**
 * A typed error hierarchy so the centralized error-handling middleware
 * (middleware/errorHandler.ts) can map any thrown error to the right HTTP
 * status code and a consistent ApiResponse body, instead of every route
 * hand-rolling its own res.status(...).json(...) on failure.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** Thrown by middleware/validateBody.ts when a request body fails its Zod schema. */
export class ValidationError extends ApiError {
  constructor(details: unknown) {
    super(400, 'VALIDATION_ERROR', 'Request validation failed', details);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a resource looked up by id doesn't exist — added in Phase 5,
 * the first phase with a read path (`GET`-by-id-shaped lookup) at all.
 * Phase 3's docs predicted this exact addition: "additional error
 * subclasses (like NotFoundError) will be added when read endpoints exist."
 */
export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}
