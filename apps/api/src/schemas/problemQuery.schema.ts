import { TRACKED_PATTERNS, type ProblemListQuery } from '@codereviewai/shared';
import { z } from 'zod';

/**
 * Validates `GET /api/problems`'s query string. Every parameter is optional,
 * and an empty string (what an HTML form sends for "no filter selected") is
 * treated the same as absent — see `parseProblemQuery()`.
 */
export const problemQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  pattern: z.enum(TRACKED_PATTERNS).optional(),
  status: z.string().trim().max(100).optional(),
  language: z.string().trim().max(100).optional(),
  sortBy: z
    .enum(['number', 'title', 'difficulty', 'language', 'status', 'complexity', 'quality', 'date'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ProblemQueryParseResult =
  | { success: true; query: ProblemListQuery }
  | { success: false; issues: Array<{ path: string; message: string }> };

export function parseProblemQuery(raw: Record<string, unknown>): ProblemQueryParseResult {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() !== '') cleaned[key] = value;
    else if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim() !== '') {
      cleaned[key] = value[0];
    }
  }

  const parsed = problemQuerySchema.safeParse(cleaned);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return { success: true, query: parsed.data };
}
