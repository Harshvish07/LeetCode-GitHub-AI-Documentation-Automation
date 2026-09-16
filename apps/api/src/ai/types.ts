import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { ReviewAgreement } from './agreement.js';
import type { SolutionReview } from './schemas/solutionReview.schema.js';

/**
 * The response shape for `POST /api/submissions/:id/review` — deliberately
 * keeps `deterministic` and `ai` as two separate, complete objects (never
 * merged into one "best guess") plus `agreement`, so a client always has
 * access to both analyses and can see exactly where — if anywhere — they
 * disagreed. This is the concrete shape that satisfies the task's "the
 * system should preserve deterministic analysis, AI analysis, confidence,
 * and disagreement" requirement.
 */
export interface CombinedSolutionReview {
  submissionId: string;
  deterministic: SolutionAnalysis;
  ai: SolutionReview;
  agreement: ReviewAgreement;
  generatedAt: string;
}
