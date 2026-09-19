import type { PatternStat } from '@codereviewai/shared';
import { problemPath } from '../../router/routes.js';
import { Badge } from '../common/Badge.js';
import { qualityTone } from '../common/tones.js';

/**
 * One row per tracked pattern: how many solved, average quality, and where
 * the improvement opportunities are (with links to the problems most worth
 * revisiting). Patterns with no solutions are shown dimmed rather than
 * hidden, so the gaps in practice are as visible as the strengths.
 */
export function PatternAnalytics({ stats }: { stats: PatternStat[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Pattern analytics">
        <thead>
          <tr>
            <th scope="col">Pattern</th>
            <th scope="col" className="num">
              Solved
            </th>
            <th scope="col" className="num">
              Avg quality
            </th>
            <th scope="col" className="num">
              To improve
            </th>
            <th scope="col">Revisit</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr
              key={stat.pattern}
              className={stat.solved === 0 ? 'row-dim' : undefined}
              data-testid={`pattern-${stat.pattern}`}
            >
              <th scope="row">{stat.pattern}</th>
              <td className="num">{stat.solved}</td>
              <td className="num">
                {stat.averageQuality === null ? (
                  <span className="muted">—</span>
                ) : (
                  <Badge tone={qualityTone(stat.averageQuality)}>{stat.averageQuality}</Badge>
                )}
              </td>
              <td className="num">{stat.improvementOpportunities}</td>
              <td>
                {stat.revisit.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  <ul className="inline-list">
                    {stat.revisit.map((problem) => (
                      <li key={problem.submissionId}>
                        <a href={problemPath(problem.submissionId)}>{problem.title}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
