import type { ReviewDetail } from '@codereviewai/shared';
import { CodeBlock } from '../common/CodeBlock.js';
import { EmptyMessage } from '../common/LoadState.js';
import { Section } from '../common/Section.js';

/** The AI's suggested alternative — labeled RECOMMENDED so it can never be mistaken for the user's own submitted code. */
export function BetterApproachPanel({ review }: { review: ReviewDetail | null }) {
  if (!review) return null;

  const better = review.betterApproach;
  if (!better) {
    return (
      <Section title="Better approach">
        <EmptyMessage>
          No better asymptotic approach exists — this solution is already optimal.
        </EmptyMessage>
      </Section>
    );
  }

  return (
    <Section title="Better approach">
      <p className="tag-recommended">RECOMMENDED SOLUTION — not your submitted code</p>
      <p>{better.description}</p>
      <dl className="meta-list">
        <div>
          <dt>Time complexity</dt>
          <dd>{better.complexity.time}</dd>
        </div>
        <div>
          <dt>Space complexity</dt>
          <dd>{better.complexity.space}</dd>
        </div>
      </dl>
      <h4>Why it is better</h4>
      <p>{better.whyBetter}</p>
      <h4>Pseudocode</h4>
      <CodeBlock code={better.pseudocode} label="Recommended pseudocode" />
      <h4>Improved code</h4>
      <CodeBlock code={better.code} label="Recommended code" />
      {review.alternativeApproaches.length > 0 ? (
        <>
          <h4>Other approaches worth knowing</h4>
          <ul className="plain-list">
            {review.alternativeApproaches.map((approach, index) => (
              <li key={index}>{approach}</li>
            ))}
          </ul>
        </>
      ) : null}
    </Section>
  );
}
