import type {
  LearningInsight,
  LeetCodeProblemInfo,
  LeetCodeSubmissionInfo,
  ProblemHistory,
} from '@codereviewai/shared';
import type { CombinedSolutionReview } from '../ai/types.js';

/**
 * Everything `generateDocument()` needs. Deliberately not just
 * `CombinedSolutionReview` on its own — that type has no `problem`/
 * `submission` fields (Phase 5 never needed them in its response), but the
 * document's "Problem Information" and "My Solution" sections do.
 */
export interface DocumentGenerationInput {
  problem: LeetCodeProblemInfo;
  submission: LeetCodeSubmissionInfo;
  review: CombinedSolutionReview;
  /** Optional (Phase 9): rendered as "Submission History" and "How My Solution Improved" when it has two or more attempts. */
  history?: ProblemHistory;
  /** Optional (Phase 9): rendered as "Recurring Mistakes" when non-empty. */
  recurringMistakes?: LearningInsight[];
}

export interface GeneratedDocument {
  /** A safe filename, e.g. "001-two-sum.md" — see formatter/filename.ts. */
  filename: string;
  /** The complete Markdown document, ready to save or publish as-is. */
  content: string;
}
