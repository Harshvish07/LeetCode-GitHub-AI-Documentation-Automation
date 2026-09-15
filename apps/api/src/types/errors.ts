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
