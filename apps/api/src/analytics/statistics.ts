import {
  TRACKED_PATTERNS,
  type DashboardSummary,
  type LeetCodeDifficulty,
  type PatternStat,
  type ProblemListItem,
  type TrackedPattern,
} from '@codereviewai/shared';
import { normalizePatterns } from './patterns.js';
import { needsImprovement } from './qualityScore.js';
import { computeStreaks } from './streak.js';

/**
 * One problem as the analytics layer sees it: the *latest* submission for
 * that problem, left-joined to its analysis/review/document (all optional —
 * a submission can be recorded before it's ever reviewed). Produced by the
 * repository, consumed only by the pure functions below, which is what
 * makes the dashboard's numbers testable with no database at all.
 */
export interface ProblemRecord {
  submissionId: string;
  problemId: string;
  number: number | null;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  language: string | null;
  status: string | null;
  submittedAt: string;
  staticPatterns: string[];
  aiPatterns: string[];
  staticTimeComplexity: string | null;
  aiTimeComplexity: string | null;
  qualityScore: number | null;
  isOptimal: boolean | null;
  correctnessConcernsCount: number | null;
  reviewed: boolean;
  githubUrl: string | null;
}

const RECENT_LIMIT = 5;
const REVISIT_LIMIT = 3;

export function recordPatterns(record: ProblemRecord): TrackedPattern[] {
  return normalizePatterns([...record.staticPatterns, ...record.aiPatterns]);
}

function recordNeedsImprovement(record: ProblemRecord): boolean {
  return (
    record.reviewed &&
    needsImprovement({
      isOptimal: record.isOptimal ?? false,
      correctnessConcernsCount: record.correctnessConcernsCount ?? 0,
    })
  );
}

export function toProblemListItem(record: ProblemRecord): ProblemListItem {
  return {
    submissionId: record.submissionId,
    problemId: record.problemId,
    number: record.number,
    slug: record.slug,
    title: record.title,
    difficulty: record.difficulty,
    patterns: recordPatterns(record),
    language: record.language,
    status: record.status,
    timeComplexity: record.aiTimeComplexity ?? record.staticTimeComplexity,
    qualityScore: record.qualityScore,
    isOptimal: record.isOptimal,
    reviewed: record.reviewed,
    submittedAt: record.submittedAt,
    githubUrl: record.githubUrl,
  };
}

export function buildSummary(
  records: ProblemRecord[],
  activityDates: Array<Date | string>,
  now: Date,
): DashboardSummary {
  const difficultyDistribution = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
  const practiced = new Set<TrackedPattern>();
  let acceptedSolutions = 0;
  let optimalSolutions = 0;
  let needingImprovementCount = 0;
  let unreviewed = 0;

  for (const record of records) {
    difficultyDistribution[record.difficulty ?? 'Unknown'] += 1;
    if (record.status === 'Accepted') acceptedSolutions += 1;
    if (!record.reviewed) unreviewed += 1;
    if (record.reviewed && record.isOptimal) optimalSolutions += 1;
    if (recordNeedsImprovement(record)) needingImprovementCount += 1;
    if (record.status === 'Accepted') {
      for (const pattern of recordPatterns(record)) practiced.add(pattern);
    }
  }

  const streaks = computeStreaks(activityDates, now);
  const recentProblems = [...records]
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
    .slice(0, RECENT_LIMIT)
    .map(toProblemListItem);

  return {
    totalProblems: records.length,
    acceptedSolutions,
    needingImprovement: needingImprovementCount,
    optimalSolutions,
    unreviewed,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    patternsPracticed: practiced.size,
    difficultyDistribution,
    recentProblems,
  };
}

/**
 * Stats for every tracked pattern (including ones with zero solutions, so
 * the dashboard can show what hasn't been practiced yet). "Solved" counts
 * Accepted solutions only; average quality is over the ones that have an AI
 * review; improvement opportunities are the solved ones that need work.
 */
export function buildPatternStats(records: ProblemRecord[]): PatternStat[] {
  return TRACKED_PATTERNS.map((pattern) => {
    const solved = records.filter(
      (record) => record.status === 'Accepted' && recordPatterns(record).includes(pattern),
    );
    const scored = solved.filter((record) => record.qualityScore !== null);
    const averageQuality =
      scored.length === 0
        ? null
        : Math.round(
            (scored.reduce((sum, record) => sum + (record.qualityScore ?? 0), 0) / scored.length) *
              10,
          ) / 10;
    const needWork = solved.filter(recordNeedsImprovement);
    const revisit = [...needWork]
      .sort((a, b) => (a.qualityScore ?? 101) - (b.qualityScore ?? 101))
      .slice(0, REVISIT_LIMIT)
      .map((record) => ({ submissionId: record.submissionId, title: record.title }));

    return {
      pattern,
      solved: solved.length,
      averageQuality,
      improvementOpportunities: needWork.length,
      revisit,
    };
  });
}
