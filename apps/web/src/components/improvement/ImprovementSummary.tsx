import type { ImprovementOutcome, ProblemHistoryOverview } from '@codereviewai/shared';
import { Badge } from '../common/Badge.js';
import type { BadgeTone } from '../common/tones.js';

const OUTCOME: Record<ImprovementOutcome, { label: string; tone: BadgeTone }> = {
  improved: { label: 'Improved', tone: 'good' },
  regressed: { label: 'Regressed', tone: 'bad' },
  'no-change': { label: 'No change detected', tone: 'neutral' },
  'single-attempt': { label: 'Single attempt', tone: 'info' },
};

/** The "how my solution improved" story: the outcome, the complexity journey, and one sentence per finding. */
export function ImprovementSummary({ overview }: { overview: ProblemHistoryOverview }) {
  const outcome = OUTCOME[overview.outcome];
  return (
    <div className="improvement-summary">
      <p>
        <Badge tone={outcome.tone}>{outcome.label}</Badge>{' '}
        <span className="muted">
          {overview.attemptCount} attempt{overview.attemptCount === 1 ? '' : 's'}
        </span>
      </p>
      {overview.complexityJourney.length >= 2 ? (
        <p aria-label="Complexity journey">
          <strong>Time complexity:</strong> {overview.complexityJourney.join(' → ')}
        </p>
      ) : null}
      <ul>
        {overview.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
