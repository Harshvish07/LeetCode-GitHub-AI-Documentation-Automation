import type { ExtensionMessage, ExtensionResponse } from '../../lib/messaging.js';
import { parseLeetCodeExtraction } from './parser.js';
import { isLeetCodeProblemUrl } from './url.js';

/**
 * Injected by manifest.json into https://leetcode.com/problems/* pages.
 * Stays idle until the popup asks for data, so a stale one-shot extraction
 * from page load never goes out of date — the popup always gets a fresh
 * read of whatever the page looks like at click time.
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    if (message.type !== 'EXTRACT_LEETCODE_DATA') {
      return undefined;
    }

    if (!isLeetCodeProblemUrl(window.location.href)) {
      sendResponse({
        type: 'EXTRACT_LEETCODE_DATA_RESULT',
        ok: false,
        error: 'This is not a LeetCode problem page.',
      });
      return undefined;
    }

    try {
      const data = parseLeetCodeExtraction(document, window.location.href);
      sendResponse({ type: 'EXTRACT_LEETCODE_DATA_RESULT', ok: true, data });
    } catch (error) {
      sendResponse({
        type: 'EXTRACT_LEETCODE_DATA_RESULT',
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error.',
      });
    }

    return undefined;
  },
);
