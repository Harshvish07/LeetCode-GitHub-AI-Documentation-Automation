import type { StoredSubmission } from '@codereviewai/shared';

/**
 * Whatever storage backend a later phase introduces (a real database) only
 * needs to implement this interface — services/submissions.service.ts
 * depends on SubmissionRepository, never on InMemorySubmissionRepository
 * directly, so swapping the implementation later touches no business logic.
 *
 * `findById` was added in Phase 5 — the first phase that actually needs a
 * read path (the AI review endpoint looks up a stored submission by id).
 * Phase 3's version of this interface intentionally started `create`-only,
 * documented as growing "when a phase actually needs" a read method — this
 * is that phase.
 */
export interface SubmissionRepository {
  create(submission: StoredSubmission): Promise<StoredSubmission>;
  findById(id: string): Promise<StoredSubmission | null>;
}

export class InMemorySubmissionRepository implements SubmissionRepository {
  private readonly submissions = new Map<string, StoredSubmission>();

  async create(submission: StoredSubmission): Promise<StoredSubmission> {
    this.submissions.set(submission.id, submission);
    return submission;
  }

  async findById(id: string): Promise<StoredSubmission | null> {
    return this.submissions.get(id) ?? null;
  }
}
