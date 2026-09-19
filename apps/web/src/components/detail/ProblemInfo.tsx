import type { ProblemDetail } from '@codereviewai/shared';
import { DifficultyBadge, QualityBadge } from '../common/Badge.js';
import { Section } from '../common/Section.js';

export function ProblemInfo({ detail }: { detail: ProblemDetail }) {
  const { problem } = detail;
  return (
    <Section title="Problem information">
      <div className="detail-head">
        <h3>
          {problem.number !== null ? `${problem.number}. ` : ''}
          {problem.title}
        </h3>
        <DifficultyBadge difficulty={problem.difficulty} />
        <QualityBadge score={detail.qualityScore} />
      </div>
      <p>
        <a href={problem.url} target="_blank" rel="noreferrer noopener">
          Open on LeetCode
        </a>
      </p>
      {problem.description ? <p className="prose">{problem.description}</p> : null}
    </Section>
  );
}
