import type { StoredSubmission } from '@codereviewai/shared';
import { randomUUID } from 'node:crypto';
import type { SubmissionRepository } from '../repositories/submissions.repository.js';
import type { ValidatedSubmissionInput } from '../schemas/submission.schema.js';

/**
 * Business logic for turning a validated request into a stored submission.
 * "Validated" here means schema-valid (middleware/validateBody.ts already
 * ran createSubmissionSchema against the raw request body before this
 * service ever sees it) — this class's job is what comes after: normalize
 * the fields, assign an id, and persist.
 */
export class SubmissionService {
  constructor(private readonly repository: SubmissionRepository) {}

  async createSubmission(input: ValidatedSubmissionInput): Promise<StoredSubmission> {
    const normalized = normalize(input);

    const submission: StoredSubmission = {
      id: randomUUID(),
      problem: normalized.problem,
      submission: normalized.submission,
      metadata: {
        ...normalized.metadata,
        receivedAt: new Date().toISOString(),
      },
    };

    return this.repository.create(submission);
  }

  async getSubmissionById(id: string): Promise<StoredSubmission | null> {
    return this.repository.findById(id);
  }
}

/**
 * Trims incidental whitespace and normalizes casing on fields where that's
 * safe to do without changing meaning (a slug, a URL). Never touches
 * `submission.code` beyond what the schema already required — trimming or
 * reformatting someone's actual source code is not this service's job.
 */
function normalize(input: ValidatedSubmissionInput): ValidatedSubmissionInput {
  return {
    problem: {
      ...input.problem,
      url: normalizeUrl(input.problem.url),
      slug: input.problem.slug.trim().toLowerCase(),
      title: input.problem.title.trim(),
      description: input.problem.description?.trim() ?? null,
    },
    submission: {
      ...input.submission,
      runtime: input.submission.runtime?.trim() ?? null,
      memory: input.submission.memory?.trim() ?? null,
    },
    metadata: {
      ...input.metadata,
    },
  };
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
