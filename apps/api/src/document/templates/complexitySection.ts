import type { LeetCodeSubmissionInfo } from '@codereviewai/shared';
import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { ReviewAgreement } from '../../ai/agreement.js';
import type { SolutionReview } from '../../ai/schemas/solutionReview.schema.js';
import { escapeMarkdown, heading } from '../markdown/markdown.js';
import { fieldOr } from './shared.js';

/**
 * "## Complexity Analysis" — deliberately keeps four separate lenses on the
 * same question rather than collapsing them into one number, per the
 * project's standing rule (carried over from Phase 5) to preserve
 * deterministic analysis, AI analysis, and any disagreement between them
 * rather than hiding it: a headline verdict, LeetCode's own reported
 * runtime/memory (real, measured, but says nothing about Big-O), the
 * static estimate, and the AI's own assessment.
 */
export function renderComplexitySection(
  submission: LeetCodeSubmissionInfo,
  deterministic: SolutionAnalysis,
  ai: SolutionReview,
  agreement: ReviewAgreement,
): string {
  const headline =
    agreement.time.matches && agreement.space.matches
      ? `Time ${escapeMarkdown(ai.complexity.time)}, Space ${escapeMarkdown(ai.complexity.space)} (static analysis and the AI agree).`
      : 'Static analysis and the AI review estimate different complexity — see the breakdown and Agreement note below.';

  const lines = [
    `**Your Solution's Complexity:** ${headline}`,
    `**LeetCode Reported Runtime/Memory:** Runtime: ${fieldOr(submission.runtime, 'not recorded')}, Memory: ${fieldOr(submission.memory, 'not recorded')}`,
    `**Static Analysis Estimate:** Time ${escapeMarkdown(deterministic.estimatedTimeComplexity.notation)} (confidence: ${deterministic.estimatedTimeComplexity.confidence.level}), Space ${escapeMarkdown(deterministic.estimatedSpaceComplexity.notation)} (confidence: ${deterministic.estimatedSpaceComplexity.confidence.level})`,
    `**AI Assessment:** Time ${escapeMarkdown(ai.complexity.time)}, Space ${escapeMarkdown(ai.complexity.space)}`,
    `**Agreement:** ${renderAgreementNote(agreement)}`,
  ];

  return [heading(2, 'Complexity Analysis'), lines.join('\n\n')].join('\n\n');
}

function renderAgreementNote(agreement: ReviewAgreement): string {
  if (agreement.time.matches && agreement.space.matches) {
    return '✅ Static analysis and the AI review agree on both time and space complexity.';
  }

  const mismatches: string[] = [];
  if (!agreement.time.matches) {
    mismatches.push(
      `time — static says ${escapeMarkdown(agreement.time.deterministic)}, AI says ${escapeMarkdown(agreement.time.ai)}`,
    );
  }
  if (!agreement.space.matches) {
    mismatches.push(
      `space — static says ${escapeMarkdown(agreement.space.deterministic)}, AI says ${escapeMarkdown(agreement.space.ai)}`,
    );
  }
  return `⚠️ Disagreement detected (${mismatches.join('; ')}). This is surfaced rather than hidden — see docs/ai-analysis.md for why.`;
}
