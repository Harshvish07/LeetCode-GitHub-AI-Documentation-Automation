import type { LeetCodeProblemInfo, LeetCodeSubmissionInfo } from './leetcode.js';

/**
 * The only source of submissions today. A literal union (of one) rather than
 * a plain string so the API can reject anything else outright, and so a
 * future source (e.g. a manual web-app submission) is a deliberate, typed
 * addition here rather than an unchecked string slipping through.
 */
export type SubmissionSource = 'extension';

export interface SubmissionMetadata {
  extractedAt: string;
  source: SubmissionSource;
}

/**
 * The wire contract for POST /api/submissions — what apps/extension sends
 * and apps/api validates (via a Zod schema shaped to match this exactly).
 * Reuses LeetCodeProblemInfo/LeetCodeSubmissionInfo as-is rather than
 * redeclaring the same fields, since the request body *is* an extraction's
 * problem/submission data, just wrapped with metadata about the request.
 */
export interface CreateSubmissionRequest {
  problem: LeetCodeProblemInfo;
  submission: LeetCodeSubmissionInfo;
  metadata: SubmissionMetadata;
}

/**
 * What the API returns after validating, normalizing, and persisting a
 * submission: the same data plus a server-assigned id and receivedAt.
 */
export interface StoredSubmission {
  id: string;
  problem: LeetCodeProblemInfo;
  submission: LeetCodeSubmissionInfo;
  metadata: SubmissionMetadata & { receivedAt: string };
}
