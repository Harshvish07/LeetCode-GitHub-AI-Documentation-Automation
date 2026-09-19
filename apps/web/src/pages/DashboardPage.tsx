import { dashboardApi } from '../api/dashboardApi.js';
import { Loadable } from '../components/common/LoadState.js';
import { Section } from '../components/common/Section.js';
import { DifficultyDistribution } from '../components/dashboard/DifficultyDistribution.js';
import { PatternAnalytics } from '../components/dashboard/PatternAnalytics.js';
import { RecentProblems } from '../components/dashboard/RecentProblems.js';
import { StatGrid } from '../components/dashboard/StatGrid.js';
import { useAsync } from '../hooks/useAsync.js';

/** Composes the dashboard from independent, separately-loading panels — each fails on its own. */
export function DashboardPage() {
  const summary = useAsync(() => dashboardApi.getSummary(), []);
  const patterns = useAsync(() => dashboardApi.getPatterns(), []);

  return (
    <div className="page-stack">
      <Loadable state={summary} what="your progress" onRetry={summary.reload}>
        {(data) => (
          <>
            <StatGrid summary={data} />
            <div className="two-col">
              <Section title="Difficulty distribution">
                <DifficultyDistribution distribution={data.difficultyDistribution} />
              </Section>
              <Section title="Recent problems" aside={<a href="#/problems">View all</a>}>
                <RecentProblems problems={data.recentProblems} />
              </Section>
            </div>
          </>
        )}
      </Loadable>

      <Section title="Pattern analytics">
        <Loadable state={patterns} what="pattern analytics" onRetry={patterns.reload}>
          {(stats) => <PatternAnalytics stats={stats} />}
        </Loadable>
      </Section>
    </div>
  );
}
