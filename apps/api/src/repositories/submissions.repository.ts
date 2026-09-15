import type { StoredSubmission } from '@codereviewai/shared';

/**
 * Whatever storage backend Phase 4 introduces (a real database) only needs
 * to implement this interface — services/submissions.service.ts depends on
 * SubmissionRepository, never on InMemorySubmissionRepository directly, so
 * swapping the implementation later touches no business logic.
 *
 * Deliberately minimal for now: only what the service actually calls today.
 * Read/update/delete methods get added here when a phase actually needs
 * them, rather than speculatively now.
 */
export interface SubmissionRepository {
  create(submission: StoredSubmission): Promise<StoredSubmission>;
}

export class InMemorySubmissionRepository implements SubmissionRepository {
  private readonly submissions = new Map<string, StoredSubmission>();

  async create(submission: StoredSubmission): Promise<StoredSubmission> {
    this.submissions.set(submission.id, submission);
    return submission;
  }
}
