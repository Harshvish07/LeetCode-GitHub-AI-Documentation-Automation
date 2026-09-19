import type { LearningInsight, ProblemHistory } from '@codereviewai/shared';
import type { ImprovementService } from './improvement.service.js';

export interface OptionalDocumentContext {
  history?: ProblemHistory;
  recurringMistakes?: LearningInsight[];
}

/**
 * The optional improvement sections for a document, or `{}` when there is no
 * database or looking the history up fails. Best-effort for the same reason
 * recording is: the document is the product of the request, and the history
 * is an extra that must never cost the caller a review that already ran
 * (only the message is logged — never stored code).
 */
export async function loadDocumentContext(
  improvement: ImprovementService | undefined,
  submissionId: string,
): Promise<OptionalDocumentContext> {
  if (!improvement) return {};
  try {
    const context = await improvement.getDocumentContext(submissionId);
    return {
      ...(context.history ? { history: context.history } : {}),
      ...(context.recurringMistakes.length > 0
        ? { recurringMistakes: context.recurringMistakes }
        : {}),
    };
  } catch (error) {
    console.error(
      '[improvement] failed to load document history:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return {};
  }
}
