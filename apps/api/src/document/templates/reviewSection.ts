import type { LeetCodeSubmissionInfo } from '@codereviewai/shared';
import type { SolutionReview } from '../../ai/schemas/solutionReview.schema.js';
import { bulletList, codeBlock, escapeMarkdown, heading } from '../markdown/markdown.js';
import { fenceLanguageTag } from '../markdown/languageTag.js';

/**
 * "## What I Did Well" + "## What Can Be Improved" + "## Is My Solution
 * Optimal?" + "## Better Approach" + "## Alternative Approaches".
 *
 * "Better Approach" is the other section (besides "My Solution") the task's
 * "distinguish YOUR SOLUTION from RECOMMENDED SOLUTION" requirement is
 * really about: when `ai.betterApproach` is non-null, its `code` is labeled
 * **RECOMMENDED SOLUTION**, visually and textually distinct from the
 * **YOUR SOLUTION** label on the actually-submitted code in
 * solutionSection.ts — the two must never be presented as the same thing,
 * and the submitted code must never be replaced by this one.
 */
export function renderReviewSection(
  submission: LeetCodeSubmissionInfo,
  ai: SolutionReview,
): string {
  const strengths = [
    heading(2, 'What I Did Well'),
    bulletList(ai.strengths.map(escapeMarkdown), 'No particular strengths were highlighted.'),
  ].join('\n\n');

  const improvements = [heading(2, 'What Can Be Improved'), renderImprovements(ai)].join('\n\n');

  const optimal = [
    heading(2, 'Is My Solution Optimal?'),
    `**${ai.optimality.isOptimal ? 'Yes' : 'No'}.** ${escapeMarkdown(ai.optimality.reasoning)}`,
  ].join('\n\n');

  const betterApproach = [heading(2, 'Better Approach'), renderBetterApproach(ai, submission)].join(
    '\n\n',
  );

  const alternatives = [
    heading(2, 'Alternative Approaches'),
    bulletList(
      ai.alternativeApproaches.map(escapeMarkdown),
      'No notable alternative approaches beyond what is covered above.',
    ),
  ].join('\n\n');

  return [strengths, improvements, optimal, betterApproach, alternatives].join('\n\n');
}

function renderImprovements(ai: SolutionReview): string {
  const parts = [
    bulletList(ai.improvements.map(escapeMarkdown), 'No specific improvements were identified.'),
  ];
  if (ai.correctnessConcerns.length > 0) {
    parts.push(
      '**⚠️ Correctness concerns:**',
      bulletList(ai.correctnessConcerns.map(escapeMarkdown)),
    );
  }
  return parts.join('\n\n');
}

function renderBetterApproach(ai: SolutionReview, submission: LeetCodeSubmissionInfo): string {
  if (ai.betterApproach === null) {
    return 'No better asymptotic approach exists — this solution is already optimal for this problem.';
  }

  const { description, pseudocode, code, complexity, whyBetter } = ai.betterApproach;

  return [
    '**RECOMMENDED SOLUTION** (a different approach than what you submitted — not a modification of your code):',
    escapeMarkdown(description),
    '**Pseudocode:**',
    codeBlock(pseudocode),
    '**Improved Code:**',
    codeBlock(code, fenceLanguageTag(submission.language)),
    `**Complexity:** Time ${escapeMarkdown(complexity.time)}, Space ${escapeMarkdown(complexity.space)}`,
    `**Why This Is Better:** ${escapeMarkdown(whyBetter)}`,
  ].join('\n\n');
}
