import { z } from 'zod';

/** `GET /api/problems/:id/compare?from=1&to=3` — attempt numbers (1-based), both required. */
export const compareQuerySchema = z.object({
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
});

export type CompareQueryParseResult =
  | { success: true; from: number; to: number }
  | { success: false; issues: Array<{ path: string; message: string }> };

export function parseCompareQuery(raw: Record<string, unknown>): CompareQueryParseResult {
  const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);
  const parsed = compareQuerySchema.safeParse({ from: first(raw.from), to: first(raw.to) });
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return { success: true, from: parsed.data.from, to: parsed.data.to };
}
