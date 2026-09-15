import type { LeetCodeDifficulty, LeetCodeLanguage, LeetCodeSubmissionStatus } from './types.js';
import {
  CODE_EDITOR_LINE_CONTAINER_SELECTORS,
  DIFFICULTY_CONTAINER_SELECTORS,
  DIFFICULTY_WHITELIST,
  KNOWN_LANGUAGES,
  LANGUAGE_CONTAINER_SELECTORS,
  SUBMISSION_RESULT_CONTAINER_SELECTORS,
  SUBMISSION_STATUS_WHITELIST,
} from './selectors.js';

/**
 * Low-level, DOM-agnostic-enough-to-test primitives. Every function takes
 * its search root as a parameter (rather than reading the global `document`)
 * so it can be exercised in tests against a plain jsdom document, and so the
 * content-script entry point is the only place that touches the real page.
 */

function collectElements(root: ParentNode, selectors: readonly string[]): Element[] {
  const found: Element[] = [];
  for (const selector of selectors) {
    try {
      found.push(...Array.from(root.querySelectorAll(selector)));
    } catch {
      // A selector the current DOM engine doesn't support — skip it rather
      // than fail the whole extraction over one bad guess.
    }
  }
  return found;
}

function textOf(el: Element): string | null {
  const text = el.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

/** First non-empty text content among elements matching any of `selectors`, in order. */
export function queryFirstText(root: ParentNode, selectors: readonly string[]): string | null {
  for (const el of collectElements(root, selectors)) {
    const text = textOf(el);
    if (text) return text;
  }
  return null;
}

export function getMetaContent(doc: Document, name: string): string | null {
  const el =
    doc.querySelector(`meta[name="${name}"]`) ?? doc.querySelector(`meta[property="${name}"]`);
  const content = el?.getAttribute('content')?.trim();
  return content && content.length > 0 ? content : null;
}

function isLeafElement(el: Element): boolean {
  return el.children.length === 0;
}

/** Scans every leaf element in `root` for one whose entire trimmed text matches the whitelist. */
function scanForExactText(root: ParentNode, whitelist: readonly string[]): string | null {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (!isLeafElement(el)) continue;
    const text = textOf(el);
    if (text && (whitelist as readonly string[]).includes(text)) {
      return text;
    }
  }
  return null;
}

/**
 * Exact-match extraction: tries the curated selector containers first (fast,
 * likely correct if our guess matches current markup), then falls back to a
 * whole-document scan for a leaf element whose exact text is in `whitelist`.
 * See selectors.ts for why exact-text matching is the primary, not the
 * fallback, strategy for this kind of field.
 */
export function findExactTextMatch(
  root: ParentNode,
  containerSelectors: readonly string[],
  whitelist: readonly string[],
): string | null {
  const containers = collectElements(root, containerSelectors);
  for (const container of containers) {
    const text = textOf(container);
    if (text && (whitelist as readonly string[]).includes(text)) {
      return text;
    }
    const nested = scanForExactText(container, whitelist);
    if (nested) return nested;
  }
  return scanForExactText(root, whitelist);
}

export function extractDifficulty(root: ParentNode): LeetCodeDifficulty | null {
  const match = findExactTextMatch(root, DIFFICULTY_CONTAINER_SELECTORS, DIFFICULTY_WHITELIST);
  return match as LeetCodeDifficulty | null;
}

export function extractLanguage(root: ParentNode): LeetCodeLanguage | null {
  const match = findExactTextMatch(root, LANGUAGE_CONTAINER_SELECTORS, KNOWN_LANGUAGES);
  return match as LeetCodeLanguage | null;
}

export function extractSubmissionStatus(root: ParentNode): LeetCodeSubmissionStatus | null {
  const match = findExactTextMatch(
    root,
    SUBMISSION_RESULT_CONTAINER_SELECTORS,
    SUBMISSION_STATUS_WHITELIST,
  );
  return match as LeetCodeSubmissionStatus | null;
}

/**
 * Best-effort only: Monaco virtualizes and tokenizes its rendered lines, so
 * this joins whatever `.view-line` elements currently exist in the DOM in
 * document order. It is not guaranteed to reproduce exact whitespace/
 * indentation, and long files scrolled out of view may render incompletely.
 * Returns null rather than a partial guess dressed up as complete code only
 * when literally no editor lines are found at all.
 */
export function extractVisibleEditorCode(root: ParentNode): string | null {
  const containers = collectElements(root, CODE_EDITOR_LINE_CONTAINER_SELECTORS);
  for (const container of containers) {
    const lines = Array.from(container.querySelectorAll('.view-line'))
      .map((line) => line.textContent ?? '')
      .filter((line) => line.length > 0);
    if (lines.length > 0) {
      return lines.join('\n');
    }
  }
  return null;
}

const RUNTIME_PATTERN = /(\d+(?:\.\d+)?)\s?ms\b/i;
const MEMORY_PATTERN = /(\d+(?:\.\d+)?)\s?MB\b/i;

/**
 * Regex substring matching (unlike the exact-match whitelist strategy above)
 * carries real false-positive risk against arbitrary page text, so this only
 * ever searches inside a matched result container — never the whole
 * document — and returns null for both fields if no such container exists.
 */
export function extractRuntimeMemory(root: ParentNode): {
  runtime: string | null;
  memory: string | null;
} {
  const containers = collectElements(root, SUBMISSION_RESULT_CONTAINER_SELECTORS);

  let runtime: string | null = null;
  let memory: string | null = null;

  for (const container of containers) {
    const text = container.textContent ?? '';
    if (!runtime) {
      const match = RUNTIME_PATTERN.exec(text);
      if (match?.[1]) runtime = `${match[1]} ms`;
    }
    if (!memory) {
      const match = MEMORY_PATTERN.exec(text);
      if (match?.[1]) memory = `${match[1]} MB`;
    }
    if (runtime && memory) break;
  }

  return { runtime, memory };
}

const NUMBERED_TITLE_PATTERN = /^(\d+)\.\s*(.+)$/;

export function parseNumberedTitle(rawTitle: string | null): {
  number: number | null;
  title: string | null;
} {
  if (!rawTitle) return { number: null, title: null };

  const match = NUMBERED_TITLE_PATTERN.exec(rawTitle);
  if (!match?.[1] || !match[2]) {
    return { number: null, title: rawTitle };
  }
  return { number: Number(match[1]), title: match[2] };
}

const DOCUMENT_TITLE_SUFFIX_PATTERN = /\s*-\s*LeetCode\s*$/i;

export function stripDocumentTitleSuffix(documentTitle: string): string | null {
  const stripped = documentTitle.replace(DOCUMENT_TITLE_SUFFIX_PATTERN, '').trim();
  return stripped.length > 0 ? stripped : null;
}
