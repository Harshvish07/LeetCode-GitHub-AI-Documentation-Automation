import type { LeetCodeProblemInfo, LeetCodeSubmissionInfo } from '@codereviewai/shared';
import { blockquote, bulletList, escapeMarkdown, heading } from '../markdown/markdown.js';
import { fieldOr } from './shared.js';

/**
 * "## Problem Information" + "## Problem Understanding". The latter leads
 * with the AI's `problemSummary` (a one-to-two sentence restatement, exactly
 * what this section needs) rather than trying to paraphrase the raw
 * extracted description ourselves; the raw description is still included
 * underneath for reference, since it's the ground truth the AI's summary
 * was derived from.
 */
export function renderProblemSection(
  problem: LeetCodeProblemInfo,
  submission: LeetCodeSubmissionInfo,
  problemSummary: string,
): string {
  const info = bulletList([
    `**Problem Number:** ${problem.number ?? 'Unknown'}`,
    `**Title:** ${fieldOr(problem.title, 'Unknown')}`,
    `**Difficulty:** ${fieldOr(problem.difficulty, 'Unknown')}`,
    `**URL:** <${problem.url}>`,
    `**Language:** ${fieldOr(submission.language, 'Unknown')}`,
    `**Submission Status:** ${fieldOr(submission.status, 'Unknown')}`,
    `**Runtime:** ${fieldOr(submission.runtime, 'Not recorded')}`,
    `**Memory:** ${fieldOr(submission.memory, 'Not recorded')}`,
  ]);

  const understandingParts = [escapeMarkdown(problemSummary)];
  if (problem.description !== null) {
    understandingParts.push(
      '**Original problem statement (as extracted):**',
      blockquote(fieldOr(problem.description, '')),
    );
  }

  return [
    heading(2, 'Problem Information'),
    info,
    '',
    heading(2, 'Problem Understanding'),
    understandingParts.join('\n\n'),
  ].join('\n');
}
