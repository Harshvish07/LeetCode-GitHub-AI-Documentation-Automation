import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../types/errors.js';

/**
 * Validates req.body against `schema` and replaces it with the parsed
 * (type-narrowed) result before calling next(). On failure, forwards a
 * ValidationError to the centralized error handler instead of each
 * controller re-implementing the same safeParse/400 dance.
 *
 * The explicit `<T>` at each call site (`validateBody<CreateSubmissionRequest>(schema)`)
 * makes TypeScript check that `schema`'s inferred output is assignable to
 * the shared wire-contract type — so if the Zod schema and the
 * @codereviewai/shared type drift apart, this fails to compile rather than
 * failing silently at runtime.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new ValidationError(formatZodIssues(result.error.issues)));
      return;
    }

    req.body = result.data;
    next();
  };
}

function formatZodIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
