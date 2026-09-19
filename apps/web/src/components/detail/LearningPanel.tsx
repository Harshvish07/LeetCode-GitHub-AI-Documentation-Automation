import type { ReviewDetail } from '@codereviewai/shared';
import { Section } from '../common/Section.js';

export function LearningPanel({ review }: { review: ReviewDetail | null }) {
  if (!review) return null;

  return (
    <Section title="Learning points">
      <ul className="plain-list">
        {review.learningPoints.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
      {review.relatedPatterns.length > 0 ? (
        <>
          <h4>Practice next</h4>
          <p>{review.relatedPatterns.join(', ')}</p>
        </>
      ) : null}
    </Section>
  );
}
