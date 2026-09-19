import type { ProblemDetail } from '@codereviewai/shared';
import { formatDate } from '../../format.js';
import { EmptyMessage } from '../common/LoadState.js';
import { Section } from '../common/Section.js';

export function GithubPanel({ document }: { document: ProblemDetail['document'] }) {
  return (
    <Section title="GitHub document">
      {document?.githubUrl ? (
        <p>
          <a href={document.githubUrl} target="_blank" rel="noreferrer noopener">
            {document.filename}
          </a>
          {document.publishedAt ? (
            <span className="muted"> — published {formatDate(document.publishedAt)}</span>
          ) : null}
        </p>
      ) : (
        <EmptyMessage>
          {document
            ? `${document.filename} has been generated but not published to GitHub yet.`
            : 'No document has been generated or published for this submission yet.'}
        </EmptyMessage>
      )}
    </Section>
  );
}
