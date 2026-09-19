import type { ProblemListItem } from '@codereviewai/shared';
import { problemPath } from '../../router/routes.js';
import { DifficultyBadge, QualityBadge, StatusBadge } from '../common/Badge.js';
import { EmptyMessage } from '../common/LoadState.js';
import { formatDate } from '../../format.js';

export function RecentProblems({ problems }: { problems: ProblemListItem[] }) {
  if (problems.length === 0) {
    return (
      <EmptyMessage>No problems yet — submit one from the extension to get started.</EmptyMessage>
    );
  }

  return (
    <ul className="recent-list" aria-label="Recent problems">
      {problems.map((problem) => (
        <li key={problem.submissionId} className="recent-item">
          <a className="recent-title" href={problemPath(problem.submissionId)}>
            {problem.number !== null ? `${problem.number}. ` : ''}
            {problem.title}
          </a>
          <span className="recent-meta">
            <DifficultyBadge difficulty={problem.difficulty} />
            <StatusBadge status={problem.status} />
            <QualityBadge score={problem.qualityScore} />
            <time dateTime={problem.submittedAt}>{formatDate(problem.submittedAt)}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}
