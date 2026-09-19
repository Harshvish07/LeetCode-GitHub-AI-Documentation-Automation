import {
  TRACKED_PATTERNS,
  compareComplexity,
  type InsightEvidence,
  type LearningInsight,
  type LearningProfile,
  type PatternLevel,
  type PatternProfile,
  type TrackedPattern,
} from '@codereviewai/shared';
import {
  ACCEPTED,
  attemptPatterns,
  attemptTime,
  groupByProblem,
  type AttemptRecord,
} from './attempts.js';
import { findPatternsInText } from './patterns.js';
import { needsImprovement } from './qualityScore.js';

/** A weakness must show up at least this many times before it is called "recurring". */
export const MIN_RECURRING = 2;
/** Fewer problems than this and the profile says so instead of implying a trend. */
export const MIN_PROBLEMS_FOR_PROFILE = 3;
/** A pattern needs at least this many problems before it can be called strong or weak. */
const MIN_PATTERN_PROBLEMS = 2;
const STRONG_QUALITY = 80;
const EXAMPLE_LIMIT = 3;

const EDGE_INPUT_WORDS =
  /\b(empty|null|none|nil|zero|negative|single|one element|duplicate|boundary|edge case|out of bounds|overflow|underflow|no elements)\b/i;

const TIME_LIMIT_EXCEEDED = 'Time Limit Exceeded';
const WRONG_ANSWER = 'Wrong Answer';

function evidence(count: number, total: number, records: AttemptRecord[]): InsightEvidence {
  const seen = new Set<string>();
  const examples: InsightEvidence['examples'] = [];
  for (const record of records) {
    if (seen.has(record.problemId)) continue;
    seen.add(record.problemId);
    examples.push({ submissionId: record.submissionId, title: record.title });
    if (examples.length === EXAMPLE_LIMIT) break;
  }
  return { count, total, examples };
}

function latestOf(group: AttemptRecord[]): AttemptRecord {
  return group[group.length - 1]!;
}

function reviewedOf(group: AttemptRecord[]): AttemptRecord[] {
  return group.filter((attempt) => attempt.reviewed);
}

function attemptNeedsWork(record: AttemptRecord): boolean {
  return (
    record.reviewed &&
    needsImprovement({
      isOptimal: record.isOptimal ?? false,
      correctnessConcernsCount: record.correctnessConcernsCount ?? 0,
    })
  );
}

/**
 * Patterns the AI's suggested better approach mentions that the user's
 * latest reviewed attempt of a problem does not use — the "you could have
 * used X here" signal. Keyword matching on stored review text: a hint, and
 * documented as one (docs/improvement-engine.md#limitations).
 */
export function suggestedPatternsFor(group: AttemptRecord[]): TrackedPattern[] {
  const reviewed = reviewedOf(group);
  const latest = reviewed[reviewed.length - 1];
  if (!latest?.betterApproachDescription) return [];
  const own = attemptPatterns(latest);
  return findPatternsInText(latest.betterApproachDescription).filter(
    (pattern) => !own.includes(pattern),
  );
}

/** For each tracked pattern, the problems (latest reviewed attempt of each) where the review suggested it. */
export function collectSuggestedPatterns(
  groups: AttemptRecord[][],
): Map<TrackedPattern, AttemptRecord[]> {
  const suggested = new Map<TrackedPattern, AttemptRecord[]>();
  for (const group of groups) {
    for (const pattern of suggestedPatternsFor(group)) {
      const list = suggested.get(pattern) ?? [];
      list.push(latestOf(group));
      suggested.set(pattern, list);
    }
  }
  return suggested;
}

export function buildPatternProfiles(groups: AttemptRecord[][]): PatternProfile[] {
  const latest = groups.map(latestOf);
  return TRACKED_PATTERNS.map((pattern) => {
    const records = latest.filter((record) => attemptPatterns(record).includes(pattern));
    const accepted = records.filter((record) => record.status === ACCEPTED).length;
    const needing = records.filter(attemptNeedsWork).length;
    const scored = records.filter((record) => record.qualityScore !== null);
    const averageQuality =
      scored.length === 0
        ? null
        : Math.round(
            (scored.reduce((sum, record) => sum + (record.qualityScore ?? 0), 0) / scored.length) *
              10,
          ) / 10;

    let level: PatternLevel;
    if (records.length === 0) level = 'untouched';
    else if (records.length < MIN_PATTERN_PROBLEMS) level = 'developing';
    else if (accepted / records.length < 0.5 || needing / records.length >= 0.5) level = 'weak';
    else if (
      accepted === records.length &&
      needing === 0 &&
      (averageQuality === null || averageQuality >= STRONG_QUALITY)
    ) {
      level = 'strong';
    } else level = 'developing';

    return {
      pattern,
      problems: records.length,
      accepted,
      averageQuality,
      needingImprovement: needing,
      level,
    };
  });
}

function topPattern(tally: Map<TrackedPattern, number>): TrackedPattern | null {
  let best: TrackedPattern | null = null;
  let bestCount = 0;
  for (const pattern of TRACKED_PATTERNS) {
    const count = tally.get(pattern) ?? 0;
    if (count > bestCount) {
      best = pattern;
      bestCount = count;
    }
  }
  return best;
}

function statusInsight(
  attempts: AttemptRecord[],
  status: string,
  id: string,
  title: string,
): LearningInsight | null {
  const matching = attempts.filter((attempt) => attempt.status === status);
  if (matching.length < MIN_RECURRING) return null;
  const problems = new Set(matching.map((attempt) => attempt.problemId)).size;
  return {
    id,
    kind: 'weakness',
    title,
    description: `${status} was the judge's verdict on ${matching.length} of ${attempts.length} recorded attempts, across ${problems} problem(s).`,
    evidence: evidence(matching.length, attempts.length, matching),
  };
}

function slowerFirstInsight(groups: AttemptRecord[][]): LearningInsight | null {
  const withReviews = groups.filter((group) => reviewedOf(group).length > 0);
  const slow: AttemptRecord[] = [];
  const tally = new Map<TrackedPattern, number>();

  for (const group of withReviews) {
    const reviewed = reviewedOf(group);
    const first = reviewed[0]!;
    const firstTime = attemptTime(first);
    const laterFaster = reviewed
      .slice(1)
      .find((attempt) => compareComplexity(firstTime, attemptTime(attempt)) === 'improved');
    const betterFaster =
      compareComplexity(firstTime, first.betterApproachTimeComplexity) === 'improved';
    if (!laterFaster && !betterFaster) continue;

    slow.push(first);
    const own = attemptPatterns(first);
    const hinted = laterFaster
      ? attemptPatterns(laterFaster).filter((pattern) => !own.includes(pattern))
      : findPatternsInText(first.betterApproachDescription ?? '').filter(
          (pattern) => !own.includes(pattern),
        );
    for (const pattern of hinted) tally.set(pattern, (tally.get(pattern) ?? 0) + 1);
  }

  if (slow.length < MIN_RECURRING) return null;
  const hint = topPattern(tally);
  const hintText = hint
    ? ` ${hint} appears in the faster approach for ${tally.get(hint)} of them.`
    : '';
  return {
    id: 'slower-first-solutions',
    kind: 'weakness',
    title: 'Often starts with a slower solution',
    description: `On ${slow.length} of ${withReviews.length} reviewed problems the first reviewed solution was asymptotically slower than a later attempt or the review's better approach.${hintText}`,
    evidence: evidence(slow.length, withReviews.length, slow),
  };
}

function edgeCaseInsight(groups: AttemptRecord[][]): LearningInsight | null {
  const withReviews = groups.filter((group) => reviewedOf(group).length > 0);
  const flagged: AttemptRecord[] = [];
  for (const group of withReviews) {
    const hit = reviewedOf(group).find((attempt) =>
      attempt.correctnessConcerns.some((concern) => EDGE_INPUT_WORDS.test(concern)),
    );
    if (hit) flagged.push(hit);
  }
  if (flagged.length < MIN_RECURRING) return null;
  return {
    id: 'missed-edge-cases',
    kind: 'weakness',
    title: 'Edge-case inputs come up in review concerns',
    description: `The review's correctness concerns mention edge-case inputs (empty, null, single-element, duplicates, boundaries) on ${flagged.length} of ${withReviews.length} reviewed problems.`,
    evidence: evidence(flagged.length, withReviews.length, flagged),
  };
}

function unresolvedInsight(groups: AttemptRecord[][]): LearningInsight | null {
  const unresolved = groups.filter(
    (group) => group.length >= 2 && !group.some((attempt) => attempt.status === ACCEPTED),
  );
  if (unresolved.length < MIN_RECURRING) return null;
  return {
    id: 'unresolved-problems',
    kind: 'weakness',
    title: 'Problems retried without reaching Accepted',
    description: `${unresolved.length} of ${groups.length} problems have several attempts and none Accepted yet.`,
    evidence: evidence(unresolved.length, groups.length, unresolved.map(latestOf)),
  };
}

function acceptedNotOptimalInsight(groups: AttemptRecord[][]): LearningInsight | null {
  const acceptedReviewed = groups
    .map(latestOf)
    .filter((record) => record.status === ACCEPTED && record.reviewed);
  const notOptimal = acceptedReviewed.filter((record) => record.isOptimal === false);
  if (notOptimal.length < MIN_RECURRING) return null;
  return {
    id: 'accepted-not-optimal',
    kind: 'weakness',
    title: 'Accepted solutions that the review calls non-optimal',
    description: `${notOptimal.length} of ${acceptedReviewed.length} reviewed Accepted solutions were flagged as not asymptotically optimal.`,
    evidence: evidence(notOptimal.length, acceptedReviewed.length, notOptimal),
  };
}

function recoveryInsight(groups: AttemptRecord[][]): LearningInsight | null {
  const struggled = groups.filter((group) => group.length >= 2 && group[0]!.status !== ACCEPTED);
  const recovered = struggled.filter((group) => latestOf(group).status === ACCEPTED);
  if (recovered.length < MIN_RECURRING) return null;
  return {
    id: 'recovers-from-failures',
    kind: 'strength',
    title: 'Turns failing attempts into Accepted solutions',
    description: `${recovered.length} of ${struggled.length} problems that did not start Accepted ended Accepted.`,
    evidence: evidence(recovered.length, struggled.length, recovered.map(latestOf)),
  };
}

function patternInsights(patterns: PatternProfile[], groups: AttemptRecord[][]): LearningInsight[] {
  const latest = groups.map(latestOf);
  const insights: LearningInsight[] = [];
  for (const profile of patterns) {
    if (profile.level !== 'weak' && profile.level !== 'strong') continue;
    const records = latest.filter((record) => attemptPatterns(record).includes(profile.pattern));
    const weak = profile.level === 'weak';
    insights.push({
      id: `${weak ? 'weak' : 'strong'}-pattern-${profile.pattern.toLowerCase().replace(/\s+/g, '-')}`,
      kind: weak ? 'weakness' : 'strength',
      title: weak ? `Struggles with ${profile.pattern}` : `Solid at ${profile.pattern}`,
      description: weak
        ? `${profile.pattern}: ${profile.accepted} of ${profile.problems} problems Accepted, ${profile.needingImprovement} needing improvement.`
        : `${profile.pattern}: all ${profile.problems} problems Accepted with none needing improvement${
            profile.averageQuality === null ? '' : ` (average quality ${profile.averageQuality})`
          }.`,
      evidence: evidence(
        weak ? profile.problems - profile.accepted : profile.accepted,
        profile.problems,
        records,
      ),
    });
  }
  return insights;
}

/**
 * The learning profile: recurring weaknesses and strengths read straight
 * off stored attempts. Every rule has a minimum evidence count
 * (`MIN_RECURRING`) and reports `count of total` plus example problems, so
 * each statement can be traced to rows; a rule with too little evidence
 * simply produces nothing. Things the data cannot show — how well the user
 * explains a solution, for instance — are never inferred; `notes` says so.
 */
export function buildLearningProfile(attempts: AttemptRecord[]): LearningProfile {
  const groups = groupByProblem(attempts);
  const reviewedAttempts = attempts.filter((attempt) => attempt.reviewed).length;
  const patterns = buildPatternProfiles(groups);

  const insights = [
    statusInsight(
      attempts,
      TIME_LIMIT_EXCEEDED,
      'repeated-time-limit-exceeded',
      'Repeated Time Limit Exceeded',
    ),
    statusInsight(attempts, WRONG_ANSWER, 'repeated-wrong-answer', 'Repeated Wrong Answer'),
    slowerFirstInsight(groups),
    edgeCaseInsight(groups),
    unresolvedInsight(groups),
    acceptedNotOptimalInsight(groups),
    recoveryInsight(groups),
    ...patternInsights(patterns, groups),
  ].filter((insight): insight is LearningInsight => insight !== null);

  const sufficientData = groups.length >= MIN_PROBLEMS_FOR_PROFILE;
  const notes: string[] = [];
  if (attempts.length === 0) {
    notes.push('No submissions have been recorded yet.');
  } else if (!sufficientData) {
    notes.push(
      `Only ${groups.length} problem(s) recorded; a profile needs at least ${MIN_PROBLEMS_FOR_PROFILE} before trends are meaningful.`,
    );
  }
  if (reviewedAttempts < attempts.length) {
    notes.push(
      `${attempts.length - reviewedAttempts} of ${attempts.length} attempts have no AI review; they count toward status-based insights only.`,
    );
  }
  notes.push(
    'Only judge status, static analysis, and AI review results are stored, so qualities such as how well a solution is explained are not measured.',
  );

  return {
    problems: groups.length,
    attempts: attempts.length,
    reviewedAttempts,
    sufficientData,
    insights,
    patterns,
    notes,
  };
}
