import type {
  ApiResponse,
  CreateSubmissionRequest,
  LeetCodeExtraction,
  StoredSubmission,
} from '@codereviewai/shared';

/**
 * Local dev API only, for now — matches manifest.json's host_permissions
 * entry, which is what lets this fetch bypass CORS (an MV3 extension with a
 * declared host_permissions grant is trusted for that origin regardless of
 * the server's own CORS headers). Pointing this at a real deployed API is a
 * later-phase deployment concern.
 */
const API_BASE_URL = 'http://localhost:4000';

/** Maps a Phase 2 extraction onto the API's wire contract — drops `warnings`, which isn't part of it. */
export function toCreateSubmissionRequest(extraction: LeetCodeExtraction): CreateSubmissionRequest {
  return {
    problem: extraction.problem,
    submission: extraction.submission,
    metadata: {
      extractedAt: extraction.extractedAt,
      source: 'extension',
    },
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type SubmitOutcome =
  | { status: 'success'; submission: StoredSubmission }
  | { status: 'validation-error'; message: string; issues: ValidationIssue[] }
  | { status: 'error'; message: string };

function isValidationIssueArray(value: unknown): value is ValidationIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { path?: unknown }).path === 'string' &&
        typeof (item as { message?: unknown }).message === 'string',
    )
  );
}

export async function submitSubmission(payload: CreateSubmissionRequest): Promise<SubmitOutcome> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      status: 'error',
      message: 'Could not reach the CodeReviewAI API. Is it running on http://localhost:4000?',
    };
  }

  let body: ApiResponse<StoredSubmission>;
  try {
    body = (await response.json()) as ApiResponse<StoredSubmission>;
  } catch {
    return {
      status: 'error',
      message: `Unexpected response from the API (HTTP ${response.status}).`,
    };
  }

  if (body.success) {
    return { status: 'success', submission: body.data };
  }

  if (response.status === 400 && body.error.code === 'VALIDATION_ERROR') {
    return {
      status: 'validation-error',
      message: body.error.message,
      issues: isValidationIssueArray(body.error.details) ? body.error.details : [],
    };
  }

  return { status: 'error', message: body.error.message };
}
