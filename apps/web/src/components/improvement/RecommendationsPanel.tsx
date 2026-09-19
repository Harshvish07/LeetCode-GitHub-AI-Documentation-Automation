import type { Recommendation, Recommendations } from '@codereviewai/shared';
import { EmptyMessage } from '../common/LoadState.js';

function RecommendationList({ items, label }: { items: Recommendation[]; label: string }) {
  if (items.length === 0) return <EmptyMessage>Nothing to suggest here right now.</EmptyMessage>;
  return (
    <ul className="insight-list" aria-label={label}>
      {items.map((item) => (
        <li key={item.pattern}>
          <strong>{item.pattern}.</strong> {item.reason}
        </li>
      ))}
    </ul>
  );
}

/** "Practice more" and "Review" lists, each entry with the stored fact that put it there. */
export function RecommendationsPanel({ recommendations }: { recommendations: Recommendations }) {
  return (
    <div className="page-stack">
      <p>{recommendations.summary}</p>
      <h3>Practice more</h3>
      <RecommendationList items={recommendations.practiceMore} label="Practice more" />
      <h3>Review</h3>
      <RecommendationList items={recommendations.review} label="Review" />
    </div>
  );
}
