import type { ProblemDetail } from '@codereviewai/shared';
import { formatDate } from '../../format.js';
import { StatusBadge } from '../common/Badge.js';
import { CodeBlock } from '../common/CodeBlock.js';
import { Section } from '../common/Section.js';

/** The user's own submitted code — always shown exactly as submitted, and never confusable with the AI's suggested code. */
export function SubmissionPanel({ detail }: { detail: ProblemDetail }) {
  const { submission } = detail;
  return (
    <Section title="Your solution" aside={<StatusBadge status={submission.status} />}>
      <dl className="meta-list">
        <div>
          <dt>Language</dt>
          <dd>{submission.language ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{submission.runtime ?? '—'}</dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd>{submission.memory ?? '—'}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDate(submission.submittedAt)}</dd>
        </div>
      </dl>
      <CodeBlock code={submission.code} label="Your submitted code" />
    </Section>
  );
}
