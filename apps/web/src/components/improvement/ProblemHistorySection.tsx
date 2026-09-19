import { improvementApi } from '../../api/improvementApi.js';
import { useAsync } from '../../hooks/useAsync.js';
import { Loadable } from '../common/LoadState.js';
import { Section } from '../common/Section.js';
import { AttemptTimeline } from './AttemptTimeline.js';
import { ComparisonList } from './ComparisonList.js';
import { ImprovementSummary } from './ImprovementSummary.js';

/**
 * A problem's submission history and improvement story, loaded on its own so
 * a history failure never hides the rest of the detail page.
 */
export function ProblemHistorySection({ submissionId }: { submissionId: string }) {
  const history = useAsync(() => improvementApi.getHistory(submissionId), [submissionId]);

  return (
    <Section title="Submission history">
      <Loadable state={history} what="history" onRetry={history.reload}>
        {(data) => (
          <div className="page-stack">
            <ImprovementSummary overview={data.overview} />
            <AttemptTimeline attempts={data.attempts} />
            <ComparisonList comparisons={data.comparisons} />
          </div>
        )}
      </Loadable>
    </Section>
  );
}
