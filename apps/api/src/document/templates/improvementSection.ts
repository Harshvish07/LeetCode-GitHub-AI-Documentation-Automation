import type { LearningInsight, ProblemHistory } from '@codereviewai/shared';
import { bulletList, escapeMarkdown, heading, table, tableCell } from '../markdown/markdown.js';

const dash = (value: string | number | null): string =>
  value === null ? '—' : tableCell(String(value));

/**
 * "## Submission History" + "## How My Solution Improved": rendered only
 * for a problem with two or more recorded attempts (the caller decides —
 * see `generateDocument`). Every value comes from stored attempts and their
 * comparison; a missing review shows as "—", never a guess.
 */
export function renderHistorySections(history: ProblemHistory): string {
  const rows = history.attempts.map((attempt) => [
    String(attempt.attemptNumber),
    tableCell(attempt.submittedAt.slice(0, 10)),
    dash(attempt.status),
    dash(attempt.language),
    dash(attempt.runtime),
    dash(attempt.memory),
    dash(attempt.timeComplexity),
    dash(attempt.spaceComplexity),
    dash(attempt.qualityScore),
  ]);

  const historySection = [
    heading(2, 'Submission History'),
    table(
      ['Attempt', 'Date', 'Status', 'Language', 'Runtime', 'Memory', 'Time', 'Space', 'Quality'],
      rows,
    ),
  ].join('\n\n');

  const steps = history.comparisons.map((comparison) =>
    [
      `**Attempt ${comparison.fromAttempt} → ${comparison.toAttempt}**`,
      bulletList(comparison.highlights.map(escapeMarkdown)),
    ].join('\n\n'),
  );

  const improved = [
    heading(2, 'How My Solution Improved'),
    bulletList(history.overview.explanation.map(escapeMarkdown)),
    ...steps,
  ].join('\n\n');

  return [historySection, improved].join('\n\n');
}

/** "## Recurring Mistakes": weakness insights from the user's whole recorded history. */
export function renderRecurringMistakes(insights: LearningInsight[]): string {
  return [
    heading(2, 'Recurring Mistakes'),
    'Patterns seen across my recorded history (not just this problem):',
    bulletList(
      insights.map(
        (insight) =>
          `**${escapeMarkdown(insight.title)}** — ${escapeMarkdown(insight.description)} (${insight.evidence.count} of ${insight.evidence.total})`,
      ),
    ),
  ].join('\n\n');
}
