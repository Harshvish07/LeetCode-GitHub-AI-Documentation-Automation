import type { ProblemListItem, ProblemSortKey, SortOrder } from '@codereviewai/shared';
import { formatDate } from '../../format.js';
import { problemPath } from '../../router/routes.js';
import { Badge, DifficultyBadge, QualityBadge, StatusBadge } from '../common/Badge.js';
import { EmptyMessage } from '../common/LoadState.js';

export interface ProblemTableProps {
  problems: ProblemListItem[];
  sortBy: ProblemSortKey;
  sortOrder: SortOrder;
  onSort: (key: ProblemSortKey) => void;
}

const COLUMNS: Array<{ label: string; key?: ProblemSortKey; numeric?: boolean }> = [
  { label: '#', key: 'number', numeric: true },
  { label: 'Problem', key: 'title' },
  { label: 'Difficulty', key: 'difficulty' },
  { label: 'Pattern' },
  { label: 'Language', key: 'language' },
  { label: 'Status', key: 'status' },
  { label: 'Complexity', key: 'complexity' },
  { label: 'Quality', key: 'quality', numeric: true },
  { label: 'Date', key: 'date' },
  { label: 'GitHub' },
];

/** The problem list. Sortable columns are buttons inside their header cell, with `aria-sort` on the header. */
export function ProblemTable({ problems, sortBy, sortOrder, onSort }: ProblemTableProps) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Problems">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={column.numeric ? 'num' : undefined}
                aria-sort={
                  column.key && column.key === sortBy
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {column.key ? (
                  <button type="button" className="sort-button" onClick={() => onSort(column.key!)}>
                    {column.label}
                    {column.key === sortBy ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {problems.map((problem) => (
            <tr key={problem.submissionId} data-testid="problem-row">
              <td className="num">{problem.number ?? '—'}</td>
              <td>
                <a href={problemPath(problem.submissionId)}>{problem.title}</a>
              </td>
              <td>
                <DifficultyBadge difficulty={problem.difficulty} />
              </td>
              <td>
                {problem.patterns.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <span className="badge-row">
                    {problem.patterns.map((pattern) => (
                      <Badge key={pattern} tone="info">
                        {pattern}
                      </Badge>
                    ))}
                  </span>
                )}
              </td>
              <td>{problem.language ?? <span className="muted">—</span>}</td>
              <td>
                <StatusBadge status={problem.status} />
              </td>
              <td>{problem.timeComplexity ?? <span className="muted">—</span>}</td>
              <td className="num">
                <QualityBadge score={problem.qualityScore} />
              </td>
              <td>
                <time dateTime={problem.submittedAt}>{formatDate(problem.submittedAt)}</time>
              </td>
              <td>
                {problem.githubUrl ? (
                  <a href={problem.githubUrl} target="_blank" rel="noreferrer noopener">
                    Document
                  </a>
                ) : (
                  <span className="muted">Not published</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {problems.length === 0 ? <EmptyMessage>No problems match these filters.</EmptyMessage> : null}
    </div>
  );
}
