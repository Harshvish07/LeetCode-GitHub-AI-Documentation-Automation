import { table, tableCell } from '../document/markdown/markdown.js';

/**
 * Renders the root README's "Problems" table from the full problems index,
 * and merges it into an existing README between two marker comments —
 * never touching anything outside them. The task's exact requirements:
 * "Do not destroy manually written sections. Use clear markers if automated
 * content is inserted." See docs/github-integration.md#automatic-readme.
 */
export interface ProblemIndexEntry {
  number: number | null;
  slug: string;
  title: string;
  difficulty: string | null;
  pattern: string;
  complexity: string;
  status: string | null;
  /** Repo-relative path to the problem's own README, for the table's link. */
  path: string;
}

export const TABLE_START_MARKER = '<!-- codereviewai:problems-table:start -->';
export const TABLE_END_MARKER = '<!-- codereviewai:problems-table:end -->';

const TABLE_HEADERS = ['#', 'Problem', 'Difficulty', 'Pattern', 'Complexity', 'Status'];

export function renderProblemsTable(entries: ProblemIndexEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));

  if (sorted.length === 0) {
    return '_No problems published yet._';
  }

  const rows = sorted.map((entry) => [
    tableCell(entry.number !== null ? String(entry.number) : '—'),
    `[${tableCell(entry.title)}](${entry.path})`,
    tableCell(entry.difficulty ?? 'Unknown'),
    tableCell(entry.pattern || 'Unknown'),
    tableCell(entry.complexity || 'Unknown'),
    tableCell(entry.status ?? 'Unknown'),
  ]);

  return table(TABLE_HEADERS, rows);
}

const DEFAULT_README = [
  '# LeetCode AI Journal',
  '',
  'Automatically generated and kept up to date by [CodeReviewAI](https://github.com) — every solved problem gets its own analysis, committed automatically.',
  '',
].join('\n');

/**
 * Replaces the content between the markers with a freshly rendered table
 * (inserting the markers, appended after existing content, the first time —
 * never overwriting or reordering anything already in the file), or
 * scaffolds a minimal default README if none exists yet at all.
 */
export function mergeProblemsTableIntoReadme(
  existingReadme: string | null,
  entries: ProblemIndexEntry[],
): string {
  const table = renderProblemsTable(entries);
  const block = `${TABLE_START_MARKER}\n\n## Problems\n\n${table}\n\n${TABLE_END_MARKER}`;

  const base = existingReadme ?? DEFAULT_README;

  const startIndex = base.indexOf(TABLE_START_MARKER);
  const endIndex = base.indexOf(TABLE_END_MARKER);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = base.slice(0, startIndex);
    const after = base.slice(endIndex + TABLE_END_MARKER.length);
    return `${before}${block}${after}`;
  }

  return `${base.trimEnd()}\n\n${block}\n`;
}
