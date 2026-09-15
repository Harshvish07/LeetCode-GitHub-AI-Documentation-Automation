/**
 * Re-exported here so everything under content/leetcode/ imports its domain
 * types from a local module rather than reaching into @codereviewai/shared
 * directly — keeps this folder self-contained and easy to relocate if a
 * future phase reorganizes the extension's source layout.
 */
export type {
  LeetCodeDifficulty,
  LeetCodeExtraction,
  LeetCodeLanguage,
  LeetCodeProblemInfo,
  LeetCodeSubmissionInfo,
  LeetCodeSubmissionStatus,
} from '@codereviewai/shared';
