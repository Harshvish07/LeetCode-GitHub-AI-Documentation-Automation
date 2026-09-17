import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { ReviewAgreement } from '../../ai/agreement.js';
import type { SolutionReview } from '../../ai/schemas/solutionReview.schema.js';
import { blockquote, bulletList, escapeMarkdown, heading } from '../markdown/markdown.js';

/**
 * "## Edge Cases" + "## Interview Explanation" + "## Key Learning" +
 * "## Related Problems / Patterns" + "## Personal Review".
 *
 * "Interview Explanation" and "Personal Review" are composed here from
 * fields the AI already produced (`userApproach`, `whyItWorks`,
 * `complexity`, `optimality`, `learningPoints`, `confidence`) rather than
 * requiring a new AI-generated field for either — both are just a different
 * *arrangement* of information this document already has elsewhere, and
 * templating them keeps the AI schema/prompt focused on the 16 required
 * review questions instead of growing a field for every section shape a
 * future document layout might want.
 */
export function renderLearningSection(deterministic: SolutionAnalysis, ai: SolutionReview): string {
  const edgeCases = [heading(2, 'Edge Cases'), renderEdgeCases(deterministic, ai)].join('\n\n');

  const interview = [
    heading(2, 'Interview Explanation'),
    'A concise explanation you could give out loud in an interview:',
    blockquote(
      [
        `**Approach:** ${escapeMarkdown(ai.userApproach)}`,
        `**Why it works:** ${escapeMarkdown(ai.whyItWorks)}`,
        `**Complexity:** ${escapeMarkdown(ai.complexity.time)} time, ${escapeMarkdown(ai.complexity.space)} space.`,
      ].join('\n\n'),
    ),
  ].join('\n\n');

  const keyLearning = [
    heading(2, 'Key Learning'),
    bulletList(ai.learningPoints.map(escapeMarkdown)),
  ].join('\n\n');

  const related = [
    heading(2, 'Related Problems / Patterns'),
    bulletList(
      ai.relatedPatterns.map(escapeMarkdown),
      'No specific related patterns were suggested.',
    ),
  ].join('\n\n');

  return [edgeCases, interview, keyLearning, related].join('\n\n');
}

function renderEdgeCases(deterministic: SolutionAnalysis, ai: SolutionReview): string {
  const parts: string[] = [];
  parts.push(
    '**AI-identified edge cases:**',
    bulletList(ai.edgeCases.map(escapeMarkdown), 'None identified.'),
  );
  if (deterministic.edgeCaseObservations.length > 0) {
    parts.push(
      '**Static-analysis edge-case observations:**',
      bulletList(
        deterministic.edgeCaseObservations.map(
          (o) => `[${o.severity}] ${escapeMarkdown(o.concern)}: ${escapeMarkdown(o.detail)}`,
        ),
      ),
    );
  }
  return parts.join('\n\n');
}

export function renderPersonalReview(
  deterministic: SolutionAnalysis,
  ai: SolutionReview,
  agreement: ReviewAgreement,
): string {
  const lines = [
    `**Solution status:** ${ai.optimality.isOptimal ? 'Optimal ✅' : 'Can be improved ⚠️'}`,
    `**Most important takeaway:** ${escapeMarkdown(ai.learningPoints[0] ?? 'N/A')}`,
    `**AI review confidence:** ${ai.confidence}`,
    `**Static analysis confidence:** ${deterministic.confidence.level}`,
  ];
  if (agreement.hasDisagreement) {
    lines.push(
      '**Note:** the static analysis and AI review disagreed on at least one point above (complexity and/or pattern detection) — worth double-checking yourself rather than trusting either blindly.',
    );
  }

  return [heading(2, 'Personal Review'), bulletList(lines)].join('\n\n');
}
