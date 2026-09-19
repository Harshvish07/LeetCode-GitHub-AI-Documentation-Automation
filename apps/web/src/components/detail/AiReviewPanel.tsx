import type { ReviewDetail } from '@codereviewai/shared';
import { Badge } from '../common/Badge.js';
import { EmptyMessage } from '../common/LoadState.js';
import { Section } from '../common/Section.js';

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ul className="plain-list">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** The AI review, plus an explicit notice whenever it disagreed with the static analysis — never hidden. */
export function AiReviewPanel({ review }: { review: ReviewDetail | null }) {
  if (!review) {
    return (
      <Section title="AI review">
        <EmptyMessage>
          No AI review yet — request one for this submission to see it here.
        </EmptyMessage>
      </Section>
    );
  }

  const { agreement } = review;

  return (
    <Section
      title="AI review"
      aside={<Badge tone="neutral">{`confidence: ${review.confidence}`}</Badge>}
    >
      {agreement.hasDisagreement ? (
        <div className="notice notice-warn" role="note" data-testid="disagreement-notice">
          <strong>Static analysis and the AI disagreed.</strong>
          <ul className="plain-list">
            {!agreement.time.matches ? (
              <li>
                Time complexity — static: {agreement.time.deterministic}, AI: {agreement.time.ai}
              </li>
            ) : null}
            {!agreement.space.matches ? (
              <li>
                Space complexity — static: {agreement.space.deterministic}, AI: {agreement.space.ai}
              </li>
            ) : null}
            {agreement.patternsOnlyInAi.length > 0 ? (
              <li>Only the AI found: {agreement.patternsOnlyInAi.join(', ')}</li>
            ) : null}
            {agreement.patternsOnlyInDeterministic.length > 0 ? (
              <li>
                Only static analysis found: {agreement.patternsOnlyInDeterministic.join(', ')}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <h4>Problem summary</h4>
      <p>{review.problemSummary}</p>
      <h4>Your approach</h4>
      <p>{review.userApproach}</p>
      <h4>Why it works</h4>
      <p>{review.whyItWorks}</p>

      <dl className="meta-list">
        <div>
          <dt>Time complexity</dt>
          <dd>{review.complexity.time}</dd>
        </div>
        <div>
          <dt>Space complexity</dt>
          <dd>{review.complexity.space}</dd>
        </div>
        <div>
          <dt>Patterns</dt>
          <dd>{review.patterns.join(', ') || '—'}</dd>
        </div>
      </dl>

      <h4>Is it optimal?</h4>
      <p>
        <Badge tone={review.optimality.isOptimal ? 'good' : 'warn'}>
          {review.optimality.isOptimal ? 'Optimal' : 'Not optimal'}
        </Badge>{' '}
        {review.optimality.reasoning}
      </p>

      <TextList title="What you did well" items={review.strengths} />
      <TextList title="Correctness concerns" items={review.correctnessConcerns} />
      <TextList title="What can be improved" items={review.improvements} />
      <TextList title="Edge cases" items={review.edgeCases} />
    </Section>
  );
}
