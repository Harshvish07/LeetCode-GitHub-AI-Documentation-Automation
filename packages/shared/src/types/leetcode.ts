/**
 * Shape of data the LeetCode extraction adapter (apps/extension) produces.
 * Kept here rather than inside apps/extension because the API (from Phase 3
 * onward) receives this exact shape from the extension.
 */
export type LeetCodeDifficulty = 'Easy' | 'Medium' | 'Hard';

export const LEETCODE_SUBMISSION_STATUSES = [
  'Accepted',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Memory Limit Exceeded',
  'Runtime Error',
  'Compile Error',
  'Output Limit Exceeded',
] as const;

export type LeetCodeSubmissionStatus = (typeof LEETCODE_SUBMISSION_STATUSES)[number];

/**
 * The whitelist the extraction adapter matches against (apps/extension) and
 * the API validates against (apps/api) — kept in one place so the two never
 * drift apart.
 */
export const LEETCODE_LANGUAGES = [
  'C++',
  'Java',
  'Python',
  'Python3',
  'C',
  'C#',
  'JavaScript',
  'TypeScript',
  'PHP',
  'Swift',
  'Kotlin',
  'Dart',
  'Go',
  'Ruby',
  'Scala',
  'Rust',
  'Racket',
  'Erlang',
  'Elixir',
  'MySQL',
  'MS SQL Server',
  'Oracle',
  'PL/SQL',
  'Bash',
] as const;

export type LeetCodeLanguage = (typeof LEETCODE_LANGUAGES)[number];

export interface LeetCodeProblemInfo {
  url: string;
  slug: string | null;
  number: number | null;
  title: string | null;
  difficulty: LeetCodeDifficulty | null;
  description: string | null;
}

export interface LeetCodeSubmissionInfo {
  language: LeetCodeLanguage | null;
  code: string | null;
  status: LeetCodeSubmissionStatus | null;
  runtime: string | null;
  memory: string | null;
}

/**
 * Every field is nullable by design: if the extractor can't find a value
 * reliably in the page's current DOM, it reports null rather than guessing.
 * `warnings` lists which fields fell back to null, for the popup's debug view.
 */
export interface LeetCodeExtraction {
  problem: LeetCodeProblemInfo;
  submission: LeetCodeSubmissionInfo;
  extractedAt: string;
  warnings: string[];
}
