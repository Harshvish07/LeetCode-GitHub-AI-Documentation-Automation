import type {
  LeetCodeDifficulty,
  LeetCodeLanguage,
  LeetCodeSubmissionStatus,
  StoredSubmission,
} from '@codereviewai/shared';
import { randomUUID } from 'node:crypto';
import type { SubmissionRepository } from '../repositories/submissions.repository.js';
import type { Database } from './database.js';
import { DEFAULT_USER_ID } from './migrations/001_initial_schema.js';
import { toIso } from './rowMapping.js';

interface SubmissionRow {
  id: string;
  problem_url: string;
  slug: string;
  number: number | null;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  description: string | null;
  language: LeetCodeLanguage | null;
  code: string;
  status: LeetCodeSubmissionStatus | null;
  runtime: string | null;
  memory: string | null;
  source: 'extension';
  extracted_at: unknown;
  received_at: unknown;
}

/**
 * The Postgres implementation of the same `SubmissionRepository` interface
 * `InMemorySubmissionRepository` implements — `SubmissionService` never
 * knows which one it has, exactly as Phase 3 promised. A submission is
 * written as two rows: its problem (upserted by slug, so every submission
 * of "two-sum" shares one `problems` row) and the submission itself.
 * Everything belongs to the built-in local user until Phase 9 adds accounts.
 */
export class PostgresSubmissionRepository implements SubmissionRepository {
  constructor(
    private readonly db: Database,
    private readonly userId: string = DEFAULT_USER_ID,
  ) {}

  async create(submission: StoredSubmission): Promise<StoredSubmission> {
    const { problem, submission: solution, metadata } = submission;
    if (problem.slug === null || problem.title === null || solution.code === null) {
      throw new Error('Cannot persist a submission missing its slug, title, or code.');
    }
    const { slug, title, code } = { slug: problem.slug, title: problem.title, code: solution.code };

    await this.db.transaction(async (tx) => {
      const [saved] = await tx.query<{ id: string }>(
        `INSERT INTO problems (id, slug, number, title, difficulty, url, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (slug) DO UPDATE SET
           number = EXCLUDED.number,
           title = EXCLUDED.title,
           difficulty = EXCLUDED.difficulty,
           url = EXCLUDED.url,
           description = EXCLUDED.description,
           updated_at = now()
         RETURNING id`,
        [
          randomUUID(),
          slug,
          problem.number,
          title,
          problem.difficulty,
          problem.url,
          problem.description,
        ],
      );

      await tx.query(
        `INSERT INTO submissions
           (id, user_id, problem_id, language, code, status, runtime, memory, source, extracted_at, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          submission.id,
          this.userId,
          saved!.id,
          solution.language,
          code,
          solution.status,
          solution.runtime,
          solution.memory,
          metadata.source,
          metadata.extractedAt,
          metadata.receivedAt,
        ],
      );
    });

    return submission;
  }

  async findById(id: string): Promise<StoredSubmission | null> {
    if (!UUID_PATTERN.test(id)) return null;

    const rows = await this.db.query<SubmissionRow>(
      `SELECT s.id, p.url AS problem_url, p.slug, p.number, p.title, p.difficulty, p.description,
              s.language, s.code, s.status, s.runtime, s.memory, s.source, s.extracted_at, s.received_at
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
        WHERE s.id = $1 AND s.user_id = $2`,
      [id, this.userId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      problem: {
        url: row.problem_url,
        slug: row.slug,
        number: row.number,
        title: row.title,
        difficulty: row.difficulty,
        description: row.description,
      },
      submission: {
        language: row.language,
        code: row.code,
        status: row.status,
        runtime: row.runtime,
        memory: row.memory,
      },
      metadata: {
        extractedAt: toIso(row.extracted_at),
        source: row.source,
        receivedAt: toIso(row.received_at),
      },
    };
  }
}

/** A non-UUID id can't exist, and Postgres would raise a cast error for it — answer "not found" instead. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
