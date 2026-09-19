import type {
  ApiResponse,
  DashboardSummary,
  PatternStat,
  ProblemDetail,
  ProblemListItem,
  ProblemListQuery,
} from '@codereviewai/shared';

/** A failed API call — either the API's own `{ success: false }` error, or a network failure. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function get<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiRequestError('Unable to reach the API.', 'NETWORK_ERROR');
  }

  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      'The API returned an unreadable response.',
      'BAD_RESPONSE',
      response.status,
    );
  }

  if (!body || typeof body !== 'object' || !('success' in body)) {
    throw new ApiRequestError(
      'The API returned an unexpected response.',
      'BAD_RESPONSE',
      response.status,
    );
  }
  if (!body.success) {
    throw new ApiRequestError(body.error.message, body.error.code ?? 'ERROR', response.status);
  }
  return body.data;
}

/** Builds `?a=1&b=2`, skipping undefined/empty values so "no filter selected" never reaches the URL. */
export function buildProblemQueryString(query: ProblemListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value.trim() !== '') params.set(key, value.trim());
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const dashboardApi = {
  getSummary: () => get<DashboardSummary>('/api/dashboard/summary'),
  getPatterns: () => get<PatternStat[]>('/api/dashboard/patterns'),
  listProblems: (query: ProblemListQuery = {}) =>
    get<ProblemListItem[]>(`/api/problems${buildProblemQueryString(query)}`),
  getProblem: (submissionId: string) =>
    get<ProblemDetail>(`/api/problems/${encodeURIComponent(submissionId)}`),
};

export type DashboardApi = typeof dashboardApi;
