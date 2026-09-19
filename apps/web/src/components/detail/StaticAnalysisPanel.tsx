import type { AnalysisDetail } from '@codereviewai/shared';
import { Badge } from '../common/Badge.js';
import { EmptyMessage } from '../common/LoadState.js';
import { Section } from '../common/Section.js';

type Observation = { message: string; severity: 'info' | 'warning' };

function Observations({ title, items }: { title: string; items: Observation[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ul className="plain-list">
        {items.map((item, index) => (
          <li key={index}>
            <Badge tone={item.severity === 'warning' ? 'warn' : 'neutral'}>{item.severity}</Badge>{' '}
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The deterministic (non-AI) analysis, shown separately from the AI review so the two can be compared. */
export function StaticAnalysisPanel({ analysis }: { analysis: AnalysisDetail | null }) {
  if (!analysis) {
    return (
      <Section title="Static analysis">
        <EmptyMessage>
          Not analyzed yet — request a review for this submission to generate it.
        </EmptyMessage>
      </Section>
    );
  }

  return (
    <Section
      title="Static analysis"
      aside={<Badge tone="neutral">{`confidence: ${analysis.confidence}`}</Badge>}
    >
      <dl className="meta-list">
        <div>
          <dt>Time complexity</dt>
          <dd>
            {analysis.timeComplexity.notation}{' '}
            <span className="muted">({analysis.timeComplexity.confidence})</span>
          </dd>
        </div>
        <div>
          <dt>Space complexity</dt>
          <dd>
            {analysis.spaceComplexity.notation}{' '}
            <span className="muted">({analysis.spaceComplexity.confidence})</span>
          </dd>
        </div>
      </dl>

      <h4>Detected patterns</h4>
      {analysis.patterns.length === 0 ? (
        <p className="muted">None detected.</p>
      ) : (
        <span className="badge-row">
          {analysis.patterns.map((match) => (
            <Badge key={match.pattern} tone="info">
              {`${match.pattern} · ${match.confidence}`}
            </Badge>
          ))}
        </span>
      )}

      <Observations title="Possible issues" items={analysis.possibleIssues} />
      <Observations title="Code quality" items={analysis.codeQualityObservations} />
      {analysis.edgeCaseObservations.length > 0 ? (
        <div>
          <h4>Edge cases to check</h4>
          <ul className="plain-list">
            {analysis.edgeCaseObservations.map((item, index) => (
              <li key={index}>
                <strong>{item.concern}:</strong> {item.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
