import type { AttemptComparison } from '@codereviewai/shared';
import { Badge } from '../common/Badge.js';

/** One card per consecutive pair of attempts, listing exactly what the comparison found. */
export function ComparisonList({ comparisons }: { comparisons: AttemptComparison[] }) {
  if (comparisons.length === 0) return null;
  return (
    <ol className="comparison-list" aria-label="Attempt comparisons">
      {comparisons.map((comparison) => (
        <li key={`${comparison.fromAttempt}-${comparison.toAttempt}`} className="comparison">
          <h3>
            Attempt {comparison.fromAttempt} → {comparison.toAttempt}{' '}
            {comparison.bugFixed ? <Badge tone="good">Bug fixed</Badge> : null}
            {comparison.algorithmChanged ? <Badge tone="info">Approach changed</Badge> : null}
          </h3>
          <ul>
            {comparison.highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
