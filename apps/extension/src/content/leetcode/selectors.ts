/**
 * Every LeetCode-specific DOM selector and text whitelist lives in this one
 * file. LeetCode's class names are largely auto-generated/utility CSS and
 * change without notice, so these are treated as *hints*, not guarantees —
 * extractor.ts always has a selector-independent fallback (an exact-text
 * scan, or a stable non-DOM source like document.title / meta tags) for
 * anything that isn't safe to guess at with regular substring matching.
 *
 * When LeetCode changes its markup, this is the only file that should need
 * updating for most breakages.
 */

export const TITLE_SELECTORS = ['[data-cy="question-title"]', 'a[href^="/problems/"]'] as const;

export const DIFFICULTY_CONTAINER_SELECTORS = ['[diff]', 'div[class*="difficulty"]'] as const;

export const DESCRIPTION_SELECTORS = [
  '[data-track-load="description_content"]',
  'div[class*="question-content"]',
] as const;

export const CODE_EDITOR_LINE_CONTAINER_SELECTORS = ['.monaco-editor .view-lines'] as const;

export const LANGUAGE_CONTAINER_SELECTORS = [
  'button[id^="headlessui-listbox-button"]',
  'div[class*="editor"] button',
] as const;

export const SUBMISSION_RESULT_CONTAINER_SELECTORS = [
  '[data-e2e-locator="submission-result"]',
  'div[class*="result"]',
] as const;

/**
 * Exact-match whitelist used instead of guessed selectors wherever possible:
 * scanning for an element whose *entire* trimmed text is one of these values
 * is far more resilient to markup changes than any CSS selector, and safe
 * from false positives because problem descriptions don't contain a leaf
 * element whose only content is literally "Easy" or "Accepted".
 */
export const DIFFICULTY_WHITELIST = ['Easy', 'Medium', 'Hard'] as const;

export {
  LEETCODE_LANGUAGES as KNOWN_LANGUAGES,
  LEETCODE_SUBMISSION_STATUSES as SUBMISSION_STATUS_WHITELIST,
} from '@codereviewai/shared';
