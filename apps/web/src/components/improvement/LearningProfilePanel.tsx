import type { InsightEvidence, LearningInsight, LearningProfile } from '@codereviewai/shared';
import { problemPath } from '../../router/routes.js';
import { Badge } from '../common/Badge.js';
import { EmptyMessage } from '../common/LoadState.js';
import type { BadgeTone } from '../common/tones.js';

const LEVEL_TONE: Record<string, BadgeTone> = {
  strong: 'good',
  developing: 'info',
  weak: 'bad',
  untouched: 'neutral',
};

function Evidence({ evidence }: { evidence: InsightEvidence }) {
  return (
    <span className="muted">
      {' '}
      ({evidence.count} of {evidence.total}
      {evidence.examples.length > 0 ? ': ' : ''}
      {evidence.examples.map((example, index) => (
        <span key={example.submissionId}>
          {index > 0 ? ', ' : ''}
          <a href={problemPath(example.submissionId)}>{example.title}</a>
        </span>
      ))}
      )
    </span>
  );
}

function InsightList({
  insights,
  label,
  empty,
}: {
  insights: LearningInsight[];
  label: string;
  empty: string;
}) {
  if (insights.length === 0) return <EmptyMessage>{empty}</EmptyMessage>;
  return (
    <ul className="insight-list" aria-label={label}>
      {insights.map((insight) => (
        <li key={insight.id}>
          <strong>{insight.title}.</strong> {insight.description}
          <Evidence evidence={insight.evidence} />
        </li>
      ))}
    </ul>
  );
}

/** Weaknesses, strengths, and per-pattern levels — each statement carries its "N of M" evidence. */
export function LearningProfilePanel({ profile }: { profile: LearningProfile }) {
  const weaknesses = profile.insights.filter((insight) => insight.kind === 'weakness');
  const strengths = profile.insights.filter((insight) => insight.kind === 'strength');
  const practiced = profile.patterns.filter((pattern) => pattern.problems > 0);

  return (
    <div className="page-stack">
      <p className="muted">
        Based on {profile.problems} problem{profile.problems === 1 ? '' : 's'} and{' '}
        {profile.attempts} attempt{profile.attempts === 1 ? '' : 's'} ({profile.reviewedAttempts}{' '}
        reviewed).
      </p>
      <h3>Recurring weaknesses</h3>
      <InsightList
        insights={weaknesses}
        label="Recurring weaknesses"
        empty="No recurring weakness is supported by your history yet."
      />
      <h3>Strengths</h3>
      <InsightList
        insights={strengths}
        label="Strengths"
        empty="No strength is supported by your history yet."
      />
      <h3>Patterns</h3>
      {practiced.length === 0 ? (
        <EmptyMessage>No reviewed solutions with a recognized pattern yet.</EmptyMessage>
      ) : (
        <div className="table-wrap">
          <table className="data-table" aria-label="Pattern levels">
            <thead>
              <tr>
                <th>Pattern</th>
                <th className="num">Problems</th>
                <th className="num">Accepted</th>
                <th className="num">Avg quality</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {practiced.map((pattern) => (
                <tr key={pattern.pattern}>
                  <td>{pattern.pattern}</td>
                  <td className="num">{pattern.problems}</td>
                  <td className="num">{pattern.accepted}</td>
                  <td className="num">{pattern.averageQuality ?? '—'}</td>
                  <td>
                    <Badge tone={LEVEL_TONE[pattern.level] ?? 'neutral'}>{pattern.level}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {profile.notes.length > 0 ? (
        <ul className="notes muted" aria-label="Limitations of this profile">
          {profile.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
