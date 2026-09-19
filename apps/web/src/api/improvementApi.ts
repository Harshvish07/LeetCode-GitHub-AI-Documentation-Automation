import type { LearningProfile, ProblemHistory, Recommendations } from '@codereviewai/shared';
import { get } from './dashboardApi.js';

/** Typed calls for the improvement engine (history, learning profile, recommendations). */
export const improvementApi = {
  getHistory: (submissionId: string) =>
    get<ProblemHistory>(`/api/problems/${encodeURIComponent(submissionId)}/history`),
  getProfile: () => get<LearningProfile>('/api/learning/profile'),
  getRecommendations: () => get<Recommendations>('/api/learning/recommendations'),
};

export type ImprovementApi = typeof improvementApi;
