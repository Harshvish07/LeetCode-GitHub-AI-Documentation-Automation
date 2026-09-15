import {
  isLeetCodeProblemUrl,
  LEETCODE_LANGUAGES,
  LEETCODE_SUBMISSION_STATUSES,
} from '@codereviewai/shared';
import { z } from 'zod';

/**
 * Runtime validation for POST /api/submissions. The extension's TypeScript
 * types (CreateSubmissionRequest, from @codereviewai/shared) only constrain
 * what a well-behaved client *should* send — they say nothing about what a
 * buggy client, a modified extension, or a hand-crafted request actually
 * sends. This schema is what the server actually trusts, independent of any
 * compile-time contract.
 *
 * Field-by-field required-vs-nullable choices deliberately mirror what the
 * Phase 2 extractor can honestly produce: a field the extractor may return
 * `null` for (because it just wasn't found on the page) is nullable here
 * too. `submission.code` is the one exception — a "submission" with no code
 * isn't meaningfully a submission, so it's required.
 */

const difficultySchema = z.enum(['Easy', 'Medium', 'Hard']).nullable();

const problemSchema = z.object({
  url: z
    .string()
    .trim()
    .url('problem.url must be a valid URL')
    .refine(isLeetCodeProblemUrl, 'problem.url must be a leetcode.com problem URL'),
  slug: z
    .string()
    .trim()
    .min(1, 'problem.slug is required')
    .regex(/^[a-z0-9-]+$/, 'problem.slug must contain only lowercase letters, digits, and hyphens'),
  number: z.number().int().positive().nullable(),
  title: z.string().trim().min(1, 'problem.title is required').max(300),
  difficulty: difficultySchema,
  description: z.string().trim().min(1).nullable(),
});

const submissionSchema = z.object({
  language: z.enum([...LEETCODE_LANGUAGES]).nullable(),
  code: z.string().trim().min(1, 'submission.code is required'),
  status: z.enum([...LEETCODE_SUBMISSION_STATUSES]).nullable(),
  runtime: z.string().trim().min(1).nullable(),
  memory: z.string().trim().min(1).nullable(),
});

const metadataSchema = z.object({
  extractedAt: z.string().datetime('metadata.extractedAt must be an ISO 8601 datetime string'),
  source: z.literal('extension'),
});

export const createSubmissionSchema = z.object({
  problem: problemSchema,
  submission: submissionSchema,
  metadata: metadataSchema,
});

/**
 * Deliberately not the same type as @codereviewai/shared's
 * CreateSubmissionRequest: that wire-level type reuses LeetCodeProblemInfo/
 * LeetCodeSubmissionInfo as-is (nullable slug/title/code, since extraction
 * can legitimately fail to find them), while this schema enforces the
 * stricter business rule that a *stored* submission needs those fields.
 * validateBody infers this type from the schema itself, and everything
 * downstream (the controller, the service) works with this narrower,
 * already-validated shape rather than the wire type's looser nullability.
 */
export type ValidatedSubmissionInput = z.infer<typeof createSubmissionSchema>;
