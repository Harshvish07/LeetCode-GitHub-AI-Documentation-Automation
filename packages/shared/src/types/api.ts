/**
 * Generic envelope every API JSON response uses, success or failure.
 * Keeping this in `shared` means the frontend, backend and extension all
 * agree on one response shape instead of each guessing at the other's format.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    /** Extra machine-readable detail, e.g. per-field validation issues. */
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Response body of GET /api/health.
 */
export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}
