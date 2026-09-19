import { dashboardApi } from '../api/dashboardApi.js';
import { Loadable } from '../components/common/LoadState.js';
import { AiReviewPanel } from '../components/detail/AiReviewPanel.js';
import { BetterApproachPanel } from '../components/detail/BetterApproachPanel.js';
import { GithubPanel } from '../components/detail/GithubPanel.js';
import { LearningPanel } from '../components/detail/LearningPanel.js';
import { ProblemHistorySection } from '../components/improvement/ProblemHistorySection.js';
import { ProblemInfo } from '../components/detail/ProblemInfo.js';
import { StaticAnalysisPanel } from '../components/detail/StaticAnalysisPanel.js';
import { SubmissionPanel } from '../components/detail/SubmissionPanel.js';
import { useAsync } from '../hooks/useAsync.js';

export function ProblemDetailPage({ submissionId }: { submissionId: string }) {
  const detail = useAsync(() => dashboardApi.getProblem(submissionId), [submissionId]);

  return (
    <div className="page-stack">
      <p>
        <a href="#/problems">← All problems</a>
      </p>
      <Loadable state={detail} what="problem" onRetry={detail.reload}>
        {(data) => (
          <>
            <ProblemInfo detail={data} />
            <SubmissionPanel detail={data} />
            <StaticAnalysisPanel analysis={data.analysis} />
            <AiReviewPanel review={data.review} />
            <BetterApproachPanel review={data.review} />
            <LearningPanel review={data.review} />
            <GithubPanel document={data.document} />
            <ProblemHistorySection submissionId={submissionId} />
          </>
        )}
      </Loadable>
    </div>
  );
}
