import {
  TRACKED_PATTERNS,
  type Recommendation,
  type Recommendations,
  type TrackedPattern,
} from '@codereviewai/shared';
import { attemptPatterns, groupByProblem, type AttemptRecord } from './attempts.js';
import {
  MIN_PROBLEMS_FOR_PROFILE,
  MIN_RECURRING,
  buildPatternProfiles,
  collectSuggestedPatterns,
} from './learningProfile.js';

const MAX_PER_LIST = 5;
const EXAMPLE_LIMIT = 3;

function examples(records: AttemptRecord[]) {
  return records
    .slice(0, EXAMPLE_LIMIT)
    .map((record) => ({ submissionId: record.submissionId, title: record.title }));
}

/**
 * Practice/review lists derived from stored history only:
 *
 * - **Review** a pattern the user has practiced but is weak at (few Accepted
 *   or mostly needing improvement), or that the AI's better approach
 *   suggested on at least two problems where the user didn't use it.
 * - **Practice more** a pattern a review suggested where the user has fewer
 *   than two problems in it — and, once there are enough problems to make it
 *   meaningful, patterns never attempted at all.
 *
 * With no history both lists are empty and the summary says why; nothing is
 * recommended "just because".
 */
export function buildRecommendations(attempts: AttemptRecord[]): Recommendations {
  const groups = groupByProblem(attempts);
  if (groups.length === 0) {
    return {
      practiceMore: [],
      review: [],
      sufficientData: false,
      summary: 'No submissions recorded yet, so there is nothing to base recommendations on.',
    };
  }

  const profiles = new Map(buildPatternProfiles(groups).map((p) => [p.pattern, p]));
  const suggested = collectSuggestedPatterns(groups);
  const latest = groups.map((group) => group[group.length - 1]!);

  const review: Array<Recommendation & { rank: number }> = [];
  const practice: Recommendation[] = [];

  for (const pattern of TRACKED_PATTERNS) {
    const profile = profiles.get(pattern)!;
    const suggestions = suggested.get(pattern) ?? [];

    if (profile.level === 'weak') {
      const records = latest.filter((record) => attemptPatterns(record).includes(pattern));
      review.push({
        pattern,
        action: 'review',
        reason: `${profile.accepted} of ${profile.problems} ${pattern} problems Accepted; ${profile.needingImprovement} need improvement.`,
        evidence: {
          count: profile.problems - profile.accepted,
          total: profile.problems,
          examples: examples(records),
        },
        rank: profile.accepted / profile.problems,
      });
    } else if (
      profile.problems > 0 &&
      profile.level !== 'strong' &&
      suggestions.length >= MIN_RECURRING
    ) {
      review.push({
        pattern,
        action: 'review',
        reason: `The review's better approach involved ${pattern} on ${suggestions.length} problems where it wasn't used.`,
        evidence: {
          count: suggestions.length,
          total: groups.length,
          examples: examples(suggestions),
        },
        rank: 1 - suggestions.length / groups.length,
      });
    } else if (profile.problems < 2 && suggestions.length >= 1) {
      practice.push({
        pattern,
        action: 'practice',
        reason:
          profile.problems === 0
            ? `The review's better approach involved ${pattern}, and you have no ${pattern} problems yet.`
            : `The review's better approach involved ${pattern}, and you have only ${profile.problems} ${pattern} problem.`,
        evidence: {
          count: suggestions.length,
          total: groups.length,
          examples: examples(suggestions),
        },
      });
    }
  }

  const sufficient = groups.length >= MIN_PROBLEMS_FOR_PROFILE;
  if (sufficient) {
    const covered = new Set<TrackedPattern>(practice.map((r) => r.pattern));
    for (const pattern of TRACKED_PATTERNS) {
      if (covered.has(pattern) || profiles.get(pattern)!.problems > 0) continue;
      practice.push({
        pattern,
        action: 'practice',
        reason: `No ${pattern} problem has been recorded among ${groups.length} problems.`,
        evidence: { count: 0, total: groups.length, examples: [] },
      });
    }
  }

  const reviewList = review
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_PER_LIST)
    .map(({ rank: _rank, ...recommendation }) => recommendation);
  const practiceList = practice.slice(0, MAX_PER_LIST);

  const parts: string[] = [];
  if (practiceList.length > 0)
    parts.push(`Practice more: ${practiceList.map((r) => r.pattern).join(', ')}.`);
  if (reviewList.length > 0) parts.push(`Review: ${reviewList.map((r) => r.pattern).join(', ')}.`);
  if (parts.length === 0) {
    parts.push(
      sufficient
        ? 'Nothing in the recorded history calls for a specific recommendation right now.'
        : `Only ${groups.length} problem(s) recorded; recommendations need more history (at least ${MIN_PROBLEMS_FOR_PROFILE} problems, or reviews that name a better approach).`,
    );
  }

  return {
    practiceMore: practiceList,
    review: reviewList,
    sufficientData: sufficient,
    summary: parts.join(' '),
  };
}
