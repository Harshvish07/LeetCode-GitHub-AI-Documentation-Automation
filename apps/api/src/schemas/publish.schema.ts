import { z } from 'zod';

/**
 * The request body for `POST /api/submissions/:id/publish`. `mode` is
 * optional (defaults to `"create"` in the controller, not here, so the
 * default lives in one place next to the rest of the create/update
 * decision logic) — its presence is the explicit, typed way a caller
 * states intent to overwrite an already-published problem, per the task's
 * "avoid accidental overwrite" / "define behavior for re-analysis"
 * requirement. See docs/github-integration.md#duplicate-handling.
 */
export const publishRequestSchema = z.object({
  mode: z.enum(['create', 'update']).optional(),
});

export type PublishRequestBody = z.infer<typeof publishRequestSchema>;
