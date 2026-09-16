import type { LeetCodeProblemInfo, LeetCodeSubmissionInfo } from '@codereviewai/shared';
import type { SolutionAnalysis } from '@codereviewai/analysis';

/**
 * Builds the prompt sent to the AI provider from exactly the fields the
 * review needs — never the full StoredSubmission. In particular this never
 * includes `id`, `metadata.receivedAt`, `metadata.extractedAt`, or
 * `metadata.source`: none of it helps the model review the solution, and
 * sending it would be exactly the kind of "unnecessary personal/incidental
 * information" the task says not to send. (Today's data model has no
 * user-identifying fields at all — no account, no email — but the
 * discipline of only forwarding what's needed is deliberate scaffolding for
 * when Phase 9 adds authentication.)
 */
export interface ReviewPromptInput {
  problem: LeetCodeProblemInfo;
  submission: LeetCodeSubmissionInfo;
  deterministicAnalysis: SolutionAnalysis;
}

/** Bounds prompt size/cost — a problem statement this long adds token cost without adding review quality. */
const MAX_DESCRIPTION_LENGTH = 2000;
/** Bounds prompt size/cost for pathologically long submissions; a truncated solution is flagged so the model doesn't silently review a partial listing as if it were complete. */
const MAX_CODE_LENGTH = 8000;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n... (truncated)` : value;
}

function orUnavailable(value: string | null): string {
  return value ?? 'Unavailable';
}

export function buildReviewSystemPrompt(): string {
  return [
    'You are an expert data structures and algorithms interviewer reviewing a candidate’s LeetCode submission.',
    'You are given the problem, the candidate’s submitted code, and a separate deterministic (non-AI) static analysis of that code, produced by a heuristic tool.',
    'Form your own independent judgment from the problem and code — the deterministic analysis is a hint, not ground truth, and it can be wrong (it is a text-based heuristic, not a real compiler or profiler). Do not just restate it.',
    'Respond with ONLY a single JSON object and nothing else: no markdown code fences, no commentary before or after it, no trailing text.',
    'The JSON object must have exactly these top-level fields:',
    '- problemSummary (string): a one-to-two sentence restatement of what the problem asks.',
    '- userApproach (string): what approach the candidate’s code actually takes.',
    '- patterns (string[]): the DSA pattern(s) the submitted code uses (e.g. "Hash Map", "Two Pointers", "Dynamic Programming").',
    '- whyItWorks (string): why this approach is correct for the problem.',
    '- complexity (object): { time: string, space: string } — your own Big-O estimate of the submitted code, as notation strings like "O(n)" or "O(n log n)".',
    '- strengths (string[]): what the candidate did well.',
    '- improvements (string[]): concrete things that could be improved.',
    '- correctnessConcerns (string[]): specific correctness risks or bugs you see, if any (empty array if none).',
    '- edgeCases (string[]): edge cases the submission may not handle correctly (empty array if none apparent).',
    '- optimality (object): { isOptimal: boolean, reasoning: string } — is this solution asymptotically optimal for the problem, and why.',
    '- betterApproach (object or null): null if the submission is already optimal; otherwise { description: string, complexity: { time: string, space: string }, whyBetter: string }.',
    '- alternativeApproaches (string[]): other valid approaches worth knowing, even if not strictly better (empty array if none worth mentioning).',
    '- learningPoints (string[]): at least one concrete thing the candidate should take away from this problem.',
    '- relatedPatterns (string[]): related DSA patterns worth practicing next.',
    '- confidence ("low" | "medium" | "high"): your own honest confidence in this review.',
    'Every array field must be present (use an empty array, never omit the field, when there is nothing to report). Do not invent facts about the code that aren’t actually there.',
  ].join('\n');
}

export function buildReviewUserPrompt(input: ReviewPromptInput): string {
  const { problem, submission, deterministicAnalysis: analysis } = input;

  const patternLines =
    analysis.detectedPatterns.length > 0
      ? analysis.detectedPatterns
          .map((p) => `- ${p.pattern} (confidence: ${p.confidence.level})`)
          .join('\n')
      : '- (none detected)';

  const qualityLines =
    analysis.codeQualityObservations.length > 0
      ? analysis.codeQualityObservations.map((o) => `- [${o.severity}] ${o.message}`).join('\n')
      : '- (none)';

  const edgeCaseLines =
    analysis.edgeCaseObservations.length > 0
      ? analysis.edgeCaseObservations
          .map((o) => `- [${o.severity}] ${o.concern}: ${o.detail}`)
          .join('\n')
      : '- (none)';

  return [
    '## Problem',
    `Title: ${orUnavailable(problem.title)}`,
    `Difficulty: ${orUnavailable(problem.difficulty)}`,
    `Description: ${truncate(orUnavailable(problem.description), MAX_DESCRIPTION_LENGTH)}`,
    '',
    '## Submitted Solution',
    `Language: ${orUnavailable(submission.language)}`,
    'Code:',
    '```',
    truncate(submission.code ?? '', MAX_CODE_LENGTH),
    '```',
    '',
    '## Deterministic Static Analysis (heuristic — may be wrong; form your own judgment)',
    `Detected patterns:\n${patternLines}`,
    `Estimated time complexity: ${analysis.estimatedTimeComplexity.notation} (confidence: ${analysis.estimatedTimeComplexity.confidence.level})`,
    `Estimated space complexity: ${analysis.estimatedSpaceComplexity.notation} (confidence: ${analysis.estimatedSpaceComplexity.confidence.level})`,
    `Code quality observations:\n${qualityLines}`,
    `Edge case observations:\n${edgeCaseLines}`,
    '',
    'Review the submitted solution and respond with the JSON object described in the system prompt.',
  ].join('\n');
}
