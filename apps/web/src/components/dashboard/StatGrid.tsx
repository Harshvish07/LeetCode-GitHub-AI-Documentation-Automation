import type { DashboardSummary } from '@codereviewai/shared';
import { StatCard } from '../common/StatCard.js';

/** The dashboard's headline numbers, one `StatCard` each. */
export function StatGrid({ summary }: { summary: DashboardSummary }) {
  const streakHint =
    summary.longestStreak > 0
      ? `Longest: ${summary.longestStreak} day${summary.longestStreak === 1 ? '' : 's'}`
      : undefined;

  return (
    <div className="stat-grid">
      <StatCard label="Total problems" value={summary.totalProblems} />
      <StatCard label="Accepted" value={summary.acceptedSolutions} />
      <StatCard
        label="Needs improvement"
        value={summary.needingImprovement}
        hint={summary.unreviewed > 0 ? `${summary.unreviewed} not reviewed yet` : undefined}
      />
      <StatCard label="Optimal" value={summary.optimalSolutions} />
      <StatCard
        label="Current streak"
        value={`${summary.currentStreak} day${summary.currentStreak === 1 ? '' : 's'}`}
        hint={streakHint}
      />
      <StatCard label="Patterns practiced" value={summary.patternsPracticed} hint="of 16 tracked" />
    </div>
  );
}
