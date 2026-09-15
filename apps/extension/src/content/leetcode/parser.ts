import type { LeetCodeExtraction } from './types.js';
import {
  extractDifficulty,
  extractLanguage,
  extractRuntimeMemory,
  extractSubmissionStatus,
  extractVisibleEditorCode,
  getMetaContent,
  parseNumberedTitle,
  queryFirstText,
  stripDocumentTitleSuffix,
} from './extractor.js';
import { DESCRIPTION_SELECTORS, TITLE_SELECTORS } from './selectors.js';
import { extractSlugFromUrl } from './url.js';

/**
 * The single public entry point of the LeetCode adapter: turns a Document
 * (the real page, or a synthetic one in tests) plus the page URL into a
 * fully-typed LeetCodeExtraction. Every field that can't be found reliably
 * is null, never guessed, and recorded in `warnings` for the popup's debug
 * view.
 */
export function parseLeetCodeExtraction(doc: Document, currentUrl: string): LeetCodeExtraction {
  const warnings: string[] = [];

  const slug = extractSlugFromUrl(currentUrl);
  if (!slug) warnings.push('slug');

  const rawTitle = queryFirstText(doc, TITLE_SELECTORS) ?? stripDocumentTitleSuffix(doc.title);
  const { number, title } = parseNumberedTitle(rawTitle);
  if (!title) warnings.push('title');
  if (number === null) warnings.push('number');

  const difficulty = extractDifficulty(doc);
  if (!difficulty) warnings.push('difficulty');

  const description =
    queryFirstText(doc, DESCRIPTION_SELECTORS) ?? getMetaContent(doc, 'description');
  if (!description) warnings.push('description');

  const language = extractLanguage(doc);
  if (!language) warnings.push('language');

  const code = extractVisibleEditorCode(doc);
  if (!code) warnings.push('code');

  const status = extractSubmissionStatus(doc);
  if (!status) warnings.push('status');

  const { runtime, memory } = extractRuntimeMemory(doc);
  if (!runtime) warnings.push('runtime');
  if (!memory) warnings.push('memory');

  return {
    problem: { url: currentUrl, slug, number, title, difficulty, description },
    submission: { language, code, status, runtime, memory },
    extractedAt: new Date().toISOString(),
    warnings,
  };
}
