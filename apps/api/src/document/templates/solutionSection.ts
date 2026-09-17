import type { LeetCodeSubmissionInfo } from '@codereviewai/shared';
import type { ReviewAgreement } from '../../ai/agreement.js';
import type { SolutionReview } from '../../ai/schemas/solutionReview.schema.js';
import { bulletList, codeBlock, escapeMarkdown, heading } from '../markdown/markdown.js';
import { fenceLanguageTag } from '../markdown/languageTag.js';

/**
 * "## My Solution" + "## My Approach" + "## DSA Pattern Used" + "## Why My
 * Solution Works". "My Solution" is the one section this module treats as
 * sacred: `submission.code` is passed straight into `codeBlock()` with no
 * escaping, transformation, or truncation of any kind — the task's "do not
 * modify the user's code" requirement, enforced structurally rather than by
 * convention. It is explicitly labeled "YOUR SOLUTION" per the task's
 * requirement to never let it be confused with the "RECOMMENDED SOLUTION"
 * a Better Approach section (see reviewSection.ts) may show later.
 */
export function renderSolutionSection(
  code: string,
  submission: LeetCodeSubmissionInfo,
  ai: SolutionReview,
  deterministic: { patterns: string[] },
  agreement: ReviewAgreement,
): string {
  const mySolution = [
    heading(2, 'My Solution'),
    '**YOUR SOLUTION** (submitted code — shown exactly as submitted, unmodified):',
    codeBlock(code, fenceLanguageTag(submission.language)),
  ].join('\n\n');

  const myApproach = [heading(2, 'My Approach'), escapeMarkdown(ai.userApproach)].join('\n\n');

  const patterns = [
    heading(2, 'DSA Pattern Used'),
    `**AI-identified patterns:**\n${bulletList(ai.patterns.map(escapeMarkdown), 'None identified.')}`,
    `**Static-analysis-detected patterns:**\n${bulletList(
      deterministic.patterns.map(escapeMarkdown),
      'None detected.',
    )}`,
    renderPatternAgreement(agreement),
  ].join('\n\n');

  const whyItWorks = [heading(2, 'Why My Solution Works'), escapeMarkdown(ai.whyItWorks)].join(
    '\n\n',
  );

  return [mySolution, myApproach, patterns, whyItWorks].join('\n\n');
}

function renderPatternAgreement(agreement: ReviewAgreement): string {
  const lines: string[] = [];
  if (agreement.patternsAgreedOn.length > 0) {
    lines.push(
      `✅ Both analyses agree on: ${agreement.patternsAgreedOn.map(escapeMarkdown).join(', ')}.`,
    );
  }
  if (agreement.patternsOnlyInAi.length > 0) {
    lines.push(
      `⚠️ Only the AI identified: ${agreement.patternsOnlyInAi.map(escapeMarkdown).join(', ')}.`,
    );
  }
  if (agreement.patternsOnlyInDeterministic.length > 0) {
    lines.push(
      `⚠️ Only static analysis detected: ${agreement.patternsOnlyInDeterministic
        .map(escapeMarkdown)
        .join(', ')}.`,
    );
  }
  if (lines.length === 0) {
    lines.push('Neither analysis identified a specific pattern.');
  }
  return lines.join('\n');
}
