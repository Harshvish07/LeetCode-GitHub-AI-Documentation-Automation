import type { LeetCodeExtraction } from '@codereviewai/shared';

/**
 * The message contract between the popup and the LeetCode content script
 * (content/leetcode/index.ts). Kept here, outside content/leetcode/,
 * because it's the extension's internal wiring, not part of the LeetCode
 * adapter itself — the popup shouldn't need to know how extraction works,
 * only this request/response shape.
 */
export interface ExtractLeetCodeDataMessage {
  type: 'EXTRACT_LEETCODE_DATA';
}

export type ExtensionMessage = ExtractLeetCodeDataMessage;

export interface ExtractLeetCodeDataSuccess {
  type: 'EXTRACT_LEETCODE_DATA_RESULT';
  ok: true;
  data: LeetCodeExtraction;
}

export interface ExtractLeetCodeDataFailure {
  type: 'EXTRACT_LEETCODE_DATA_RESULT';
  ok: false;
  error: string;
}

export type ExtensionResponse = ExtractLeetCodeDataSuccess | ExtractLeetCodeDataFailure;

export function getExtensionStatusMessage(): string {
  return 'CodeReviewAI extension loaded and ready';
}
