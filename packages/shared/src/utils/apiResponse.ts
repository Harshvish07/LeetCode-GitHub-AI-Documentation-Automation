import type { ApiError, ApiResponse, ApiSuccess } from '../types/api.js';

export function success<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function failure(message: string, code?: string, details?: unknown): ApiError {
  return details === undefined
    ? { success: false, error: { message, code } }
    : { success: false, error: { message, code, details } };
}

export function isSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success;
}
