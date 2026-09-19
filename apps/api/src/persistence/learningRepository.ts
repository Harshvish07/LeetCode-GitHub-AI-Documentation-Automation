import type { ProblemDetail } from '@codereviewai/shared';
import type { CombinedSolutionReview } from '../ai/types.js';
import type { AttemptRecord } from '../analytics/attempts.js';
import type { ProblemRecord } from '../analytics/statistics.js';
import type { GeneratedDocument } from '../document/types.js';

export interface PublicationInfo {
  path: string;
  /** A browsable link to the published file on GitHub. */
  documentUrl: string;
  commitUrl?: string;
  publishedAt: string;
}

/**
 * The write side of the learning read-model: what the review, document, and
 * publish endpoints record so the dashboard has something to show. Kept as
 * its own interface (separate from `LearningReader`) so the endpoints that
 * only write never depend on the query methods, and vice versa.
 */
export interface LearningRecorder {
  recordReview(review: CombinedSolutionReview): Promise<void>;
  recordDocument(submissionId: string, document: GeneratedDocument): Promise<void>;
  recordPublication(submissionId: string, publication: PublicationInfo): Promise<void>;
}

/** The read side: everything the dashboard API needs, already scoped to one user. */
export interface LearningReader {
  /** One record per problem — its latest submission, left-joined to analysis/review/document. */
  listProblemRecords(): Promise<ProblemRecord[]>;
  /** Every submission timestamp, for streak calculation. */
  listActivityDates(): Promise<string[]>;
  getProblemDetail(submissionId: string): Promise<ProblemDetail | null>;
  /** Every submission the user has made, each with its review data when it has one, oldest first. */
  listAttemptRecords(): Promise<AttemptRecord[]>;
  /** Every attempt at the problem that `submissionId` belongs to, oldest first; `null` when no such submission. */
  getProblemAttempts(submissionId: string): Promise<AttemptRecord[] | null>;
}
