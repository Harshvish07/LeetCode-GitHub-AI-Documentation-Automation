import { improvementApi } from '../api/improvementApi.js';
import { Loadable } from '../components/common/LoadState.js';
import { Section } from '../components/common/Section.js';
import { LearningProfilePanel } from '../components/improvement/LearningProfilePanel.js';
import { RecommendationsPanel } from '../components/improvement/RecommendationsPanel.js';
import { useAsync } from '../hooks/useAsync.js';

export function LearningPage() {
  const profile = useAsync(() => improvementApi.getProfile(), []);
  const recommendations = useAsync(() => improvementApi.getRecommendations(), []);

  return (
    <div className="page-stack">
      <Section title="What to work on">
        <Loadable state={recommendations} what="recommendations" onRetry={recommendations.reload}>
          {(data) => <RecommendationsPanel recommendations={data} />}
        </Loadable>
      </Section>
      <Section title="Learning profile">
        <Loadable state={profile} what="your learning profile" onRetry={profile.reload}>
          {(data) => <LearningProfilePanel profile={data} />}
        </Loadable>
      </Section>
    </div>
  );
}
