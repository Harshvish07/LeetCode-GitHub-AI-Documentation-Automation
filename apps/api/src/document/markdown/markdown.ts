/**
 * Low-level Markdown-building primitives — the only place in `apps/api` that
 * knows Markdown syntax. Every template in `document/templates/` (Phase 6)
 * and `github/readmeTable.ts` (Phase 7) is built exclusively from these, so
 * escaping/fencing rules only ever need fixing in one place. Targets
 * GitHub-Flavored Markdown rendering (Phase 6's generated documents and
 * Phase 7's published repository are both ultimately rendered by GitHub —
 * see docs/document-generation.md), not the strictest reading of the
 * CommonMark spec; see that doc's "Escaping" section for the one known gap
 * (setext-style headings using `=`/`-` underlines are only partially
 * covered).
 */

export function heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): string {
  return `${'#'.repeat(level)} ${text}`;
}

/** Renders a bullet list, one item per line. Falls back to a single "(none)"-style line when empty, so a section never renders as a bare, confusing heading with nothing under it. */
export function bulletList(items: string[], emptyText = '(none)'): string {
  if (items.length === 0) return `- ${emptyText}`;
  return items.map((item) => `- ${item}`).join('\n');
}

export function blockquote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n');
}

/**
 * Fences `code` for display, choosing a fence length longer than any run of
 * backticks already inside `code` so the fenced block can never be broken
 * out of by the code's own content — this is what makes "exact, unmodified
 * code" safe to embed. `code` itself is never altered in any way.
 */
export function codeBlock(code: string, language = ''): string {
  const fence = pickFence(code);
  return `${fence}${language}\n${code}\n${fence}`;
}

function pickFence(code: string): string {
  const runs = code.match(/`+/g) ?? [];
  const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longestRun + 1));
}

const INLINE_ESCAPE_MAP: Record<string, string> = {
  '\\': '\\\\',
  '`': '\\`',
  '*': '\\*',
  _: '\\_',
  '[': '\\[',
  ']': '\\]',
  '<': '\\<',
  '>': '\\>',
};
const INLINE_SPECIAL = /[\\`*_[\]<>]/g;

/**
 * Escapes Markdown-significant characters in arbitrary, untrusted-formatting
 * text (problem descriptions, AI prose) before it's embedded in the
 * document — so it can never inject a heading, list, blockquote, or code
 * fence of its own. Safe for both single-line values (bullet fields) and
 * multi-line paragraphs. Never applied to actual source code — see
 * `codeBlock()`, which preserves code byte-for-byte inside a fence instead.
 */
export function escapeMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      escapeLeadingMarker(line.replace(INLINE_SPECIAL, (ch) => INLINE_ESCAPE_MAP[ch]!)),
    )
    .join('\n');
}

/** Escapes a value for use inside one GitHub-Flavored-Markdown table cell — `escapeMarkdown()` plus pipe-escaping (pipes delimit table columns) and newline collapsing (a cell can't span multiple lines). */
export function tableCell(text: string): string {
  return escapeMarkdown(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Renders a GFM table from already-escaped `headers`/`rows` (pass each cell
 * through `tableCell()` first — this function does not escape for you, so
 * that headers built from static strings aren't needlessly re-escaped).
 */
export function table(headers: string[], rows: string[][]): string {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerRow, separatorRow, ...bodyRows].join('\n');
}

function escapeLeadingMarker(line: string): string {
  const setext = /^(\s*)(=+)\s*$/.exec(line);
  if (setext) {
    const leading = setext[1]!;
    return `${leading}\\${line.slice(leading.length)}`;
  }

  const marker = /^(\s*)([-+>]|#{1,6}(?=\s|$)|\d+[.)])/.exec(line);
  if (!marker) return line;

  const leading = marker[1]!;
  return `${leading}\\${line.slice(leading.length)}`;
}
