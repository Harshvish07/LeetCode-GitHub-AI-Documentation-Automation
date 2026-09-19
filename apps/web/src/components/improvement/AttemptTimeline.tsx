import type { AttemptSummary } from '@codereviewai/shared';
import { formatDate } from '../../format.js';
import { QualityBadge, StatusBadge } from '../common/Badge.js';
import { CodeBlock } from '../common/CodeBlock.js';

const dash = (value: string | null): string => value ?? '—';

/** Every attempt in order — status, runtime, memory, and (when reviewed) complexity and quality. */
export function AttemptTimeline({ attempts }: { attempts: AttemptSummary[] }) {
  return (
    <ol className="attempt-list" aria-label="Attempts">
      {attempts.map((attempt) => (
        <li key={attempt.submissionId} className="attempt">
          <div className="attempt-head">
            <strong>Attempt {attempt.attemptNumber}</strong>
            <StatusBadge status={attempt.status} />
            <span className="muted">{formatDate(attempt.submittedAt)}</span>
            <QualityBadge score={attempt.qualityScore} />
          </div>
          <dl className="attempt-facts">
            <div>
              <dt>Language</dt>
              <dd>{dash(attempt.language)}</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{dash(attempt.runtime)}</dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd>{dash(attempt.memory)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{dash(attempt.timeComplexity)}</dd>
            </div>
            <div>
              <dt>Space</dt>
              <dd>{dash(attempt.spaceComplexity)}</dd>
            </div>
          </dl>
          {attempt.reviewed ? (
            attempt.approach ? (
              <p className="attempt-approach">{attempt.approach}</p>
            ) : null
          ) : (
            <p className="muted">No AI review for this attempt.</p>
          )}
          <details>
            <summary>Show code</summary>
            <CodeBlock code={attempt.code} label={`Code of attempt ${attempt.attemptNumber}`} />
          </details>
        </li>
      ))}
    </ol>
  );
}
