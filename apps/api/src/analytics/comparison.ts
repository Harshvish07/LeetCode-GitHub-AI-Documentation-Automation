import {
  compareComplexity,
  type AttemptComparison,
  type AttemptSummary,
  type ImprovementOutcome,
  type ProblemHistory,
  type StatusChange,
  type TrackedPattern,
} from '@codereviewai/shared';
import {
  ACCEPTED,
  attemptPatterns,
  attemptSpace,
  attemptTime,
  type AttemptRecord,
} from './attempts.js';
import { diffLines } from './lineDiff.js';

export function toAttemptSummary(record: AttemptRecord, attemptNumber: number): AttemptSummary {
  return {
    attemptNumber,
    submissionId: record.submissionId,
    submittedAt: record.submittedAt,
    language: record.language,
    status: record.status,
    runtime: record.runtime,
    memory: record.memory,
    code: record.code,
    reviewed: record.reviewed,
    timeComplexity: record.reviewed ? attemptTime(record) : null,
    spaceComplexity: record.reviewed ? attemptSpace(record) : null,
    patterns: record.reviewed ? attemptPatterns(record) : [],
    qualityScore: record.qualityScore,
    isOptimal: record.isOptimal,
    correctnessConcernsCount: record.correctnessConcernsCount,
    improvementsCount: record.improvementsCount,
    approach: record.approach,
  };
}

function statusChange(from: string | null, to: string | null): StatusChange {
  if (from === to) return 'unchanged';
  if (to === ACCEPTED) return 'fixed';
  if (from === ACCEPTED) return 'regressed';
  return 'changed';
}

function delta(from: number | null, to: number | null): number | null {
  return from === null || to === null ? null : to - from;
}

const label = (value: string | null): string => value ?? 'unknown status';

/**
 * Compares two attempts of the same problem using only stored facts: the
 * judge's status, the review-derived complexity/patterns/quality (when both
 * attempts were reviewed), and a line diff of the code. Every conclusion
 * that needs a review is `null`/"unknown" when a review is missing, and
 * every `highlights` sentence is generated from a field of the result —
 * nothing is inferred beyond that.
 */
export function compareAttempts(
  from: AttemptRecord,
  fromNumber: number,
  to: AttemptRecord,
  toNumber: number,
): AttemptComparison {
  const reviewedBoth = from.reviewed && to.reviewed;
  const fromTime = from.reviewed ? attemptTime(from) : null;
  const toTime = to.reviewed ? attemptTime(to) : null;
  const fromSpace = from.reviewed ? attemptSpace(from) : null;
  const toSpace = to.reviewed ? attemptSpace(to) : null;

  const fromPatterns = from.reviewed ? attemptPatterns(from) : [];
  const toPatterns = to.reviewed ? attemptPatterns(to) : [];
  const added: TrackedPattern[] = reviewedBoth
    ? toPatterns.filter((p) => !fromPatterns.includes(p))
    : [];
  const removed: TrackedPattern[] = reviewedBoth
    ? fromPatterns.filter((p) => !toPatterns.includes(p))
    : [];

  const timeChange = compareComplexity(fromTime, toTime);
  const spaceChange = compareComplexity(fromSpace, toSpace);
  const status = statusChange(from.status, to.status);

  const qualityDelta = delta(from.qualityScore, to.qualityScore);
  const concernsDelta = delta(from.correctnessConcernsCount, to.correctnessConcernsCount);
  const bugFixed = status === 'fixed' || (concernsDelta !== null && concernsDelta < 0);

  const algorithmChanged: boolean | null = reviewedBoth
    ? added.length > 0 ||
      removed.length > 0 ||
      timeChange === 'improved' ||
      timeChange === 'regressed'
    : null;

  const diff = diffLines(from.code, to.code);
  const languageChanged = from.language !== to.language;

  const highlights: string[] = [];
  if (status === 'fixed') {
    highlights.push(`Status improved from ${label(from.status)} to ${ACCEPTED}.`);
  } else if (status === 'regressed') {
    highlights.push(`Status got worse: ${ACCEPTED} to ${label(to.status)}.`);
  } else if (status === 'changed') {
    highlights.push(`Status changed from ${label(from.status)} to ${label(to.status)}.`);
  } else {
    highlights.push(`Status stayed ${label(to.status)}.`);
  }

  if (!reviewedBoth) {
    highlights.push(
      'One or both attempts have no review, so complexity, pattern and quality comparisons are unavailable.',
    );
  } else {
    if (timeChange === 'improved') {
      highlights.push(`Time complexity improved from ${fromTime} to ${toTime}.`);
    } else if (timeChange === 'regressed') {
      highlights.push(`Time complexity got worse: ${fromTime} to ${toTime}.`);
    } else if (timeChange === 'same') {
      highlights.push(`Time complexity stayed ${toTime}.`);
    } else if (fromTime !== toTime) {
      highlights.push(`Time complexity changed from ${fromTime} to ${toTime}.`);
    }
    if (spaceChange === 'improved' || spaceChange === 'regressed') {
      highlights.push(
        `Space complexity ${spaceChange === 'improved' ? 'improved' : 'got worse'}: ${fromSpace} to ${toSpace}.`,
      );
    }
    if (added.length > 0) highlights.push(`Started using: ${added.join(', ')}.`);
    if (removed.length > 0) highlights.push(`Stopped using: ${removed.join(', ')}.`);
    if (concernsDelta !== null && concernsDelta < 0) {
      highlights.push(
        `Review correctness concerns dropped from ${from.correctnessConcernsCount} to ${to.correctnessConcernsCount}.`,
      );
    } else if (concernsDelta !== null && concernsDelta > 0) {
      highlights.push(
        `Review correctness concerns rose from ${from.correctnessConcernsCount} to ${to.correctnessConcernsCount}.`,
      );
    }
    if (qualityDelta !== null && qualityDelta !== 0) {
      highlights.push(
        `Quality score ${qualityDelta > 0 ? 'rose' : 'fell'} from ${from.qualityScore} to ${to.qualityScore}.`,
      );
    }
  }

  if (diff.identical) highlights.push('The code did not change (ignoring whitespace).');
  else highlights.push(`Code: ${diff.added} line(s) added, ${diff.removed} removed.`);
  if (languageChanged) {
    highlights.push(
      `Language changed from ${from.language ?? 'unknown'} to ${to.language ?? 'unknown'}.`,
    );
  }

  return {
    fromAttempt: fromNumber,
    toAttempt: toNumber,
    status: { from: from.status, to: to.status, change: status },
    timeComplexity: { from: fromTime, to: toTime, change: timeChange },
    spaceComplexity: { from: fromSpace, to: toSpace, change: spaceChange },
    patterns: { added, removed },
    algorithmChanged,
    qualityScore: { from: from.qualityScore, to: to.qualityScore, delta: qualityDelta },
    correctnessConcerns: {
      from: from.correctnessConcernsCount,
      to: to.correctnessConcernsCount,
      delta: concernsDelta,
    },
    bugFixed,
    codeQualityImproved: qualityDelta === null ? null : qualityDelta > 0,
    code: {
      linesAdded: diff.added,
      linesRemoved: diff.removed,
      languageChanged,
      identical: diff.identical,
    },
    reviewedBoth,
    highlights,
  };
}

/**
 * The full story of one problem. `attempts` must all belong to the same
 * problem and be sorted oldest first (`groupByProblem` does both); an empty
 * list is a programming error, not a data condition, so it throws.
 */
export function buildProblemHistory(attempts: AttemptRecord[]): ProblemHistory {
  const first = attempts[0];
  if (!first) throw new Error('Cannot build a history from zero attempts.');

  const summaries = attempts.map((record, index) => toAttemptSummary(record, index + 1));
  const comparisons = attempts
    .slice(1)
    .map((record, index) => compareAttempts(attempts[index]!, index + 1, record, index + 2));

  const last = attempts[attempts.length - 1]!;
  const firstAcceptedIndex = attempts.findIndex((record) => record.status === ACCEPTED);

  const reviewed = attempts.filter((record) => record.reviewed);
  const complexityJourney: string[] = [];
  for (const record of reviewed) {
    const time = attemptTime(record);
    if (time !== null && complexityJourney[complexityJourney.length - 1] !== time) {
      complexityJourney.push(time);
    }
  }

  const explanation: string[] = [];
  let improvements = 0;
  let regressions = 0;

  if (attempts.length === 1) {
    explanation.push(
      'Only one attempt has been recorded, so there is no improvement to describe yet.',
    );
  } else {
    explanation.push(
      `Status path: ${summaries.map((s) => `${label(s.status)} (attempt ${s.attemptNumber})`).join(' → ')}.`,
    );

    if (last.status === ACCEPTED && first.status !== ACCEPTED) {
      improvements += 1;
      explanation.push(
        `Reached ${ACCEPTED} on attempt ${firstAcceptedIndex + 1} after ${firstAcceptedIndex} unsuccessful attempt(s).`,
      );
    } else if (first.status === ACCEPTED && last.status !== ACCEPTED) {
      regressions += 1;
      explanation.push(
        `The latest attempt is ${label(last.status)}, after an earlier ${ACCEPTED}.`,
      );
    }

    const firstReviewed = reviewed[0];
    const lastReviewed = reviewed[reviewed.length - 1];
    if (reviewed.length < 2 || !firstReviewed || !lastReviewed) {
      explanation.push(
        'Fewer than two attempts have a review, so complexity, pattern and quality changes cannot be described.',
      );
    } else {
      const timeChange = compareComplexity(attemptTime(firstReviewed), attemptTime(lastReviewed));
      if (timeChange === 'improved') improvements += 1;
      if (timeChange === 'regressed') regressions += 1;
      if (complexityJourney.length >= 2) {
        explanation.push(`Time complexity went ${complexityJourney.join(' → ')}.`);
      } else if (complexityJourney.length === 1) {
        explanation.push(
          `Time complexity stayed ${complexityJourney[0]} across reviewed attempts.`,
        );
      }

      const before = attemptPatterns(firstReviewed);
      const after = attemptPatterns(lastReviewed);
      const gained = after.filter((p) => !before.includes(p));
      const dropped = before.filter((p) => !after.includes(p));
      if (gained.length > 0) explanation.push(`Adopted: ${gained.join(', ')}.`);
      if (dropped.length > 0) explanation.push(`Moved away from: ${dropped.join(', ')}.`);

      const qualityDelta = delta(firstReviewed.qualityScore, lastReviewed.qualityScore);
      if (qualityDelta !== null && qualityDelta > 0) {
        improvements += 1;
        explanation.push(
          `Quality score rose from ${firstReviewed.qualityScore} to ${lastReviewed.qualityScore}.`,
        );
      } else if (qualityDelta !== null && qualityDelta < 0) {
        regressions += 1;
        explanation.push(
          `Quality score fell from ${firstReviewed.qualityScore} to ${lastReviewed.qualityScore}.`,
        );
      }
    }

    const fixes = comparisons.filter((comparison) => comparison.bugFixed).length;
    if (fixes > 0) explanation.push(`A bug fix is indicated in ${fixes} step(s).`);
  }

  const outcome: ImprovementOutcome =
    attempts.length === 1
      ? 'single-attempt'
      : improvements > regressions
        ? 'improved'
        : regressions > improvements
          ? 'regressed'
          : 'no-change';

  return {
    problem: {
      number: first.number,
      slug: first.slug,
      title: first.title,
      difficulty: first.difficulty,
    },
    attempts: summaries,
    comparisons,
    overview: {
      attemptCount: attempts.length,
      firstStatus: first.status,
      finalStatus: last.status,
      finalAccepted: last.status === ACCEPTED,
      firstAcceptedAttempt: firstAcceptedIndex === -1 ? null : firstAcceptedIndex + 1,
      complexityJourney,
      outcome,
      explanation,
    },
  };
}
