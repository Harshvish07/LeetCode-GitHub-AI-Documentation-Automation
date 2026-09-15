import { describe, expect, it } from 'vitest';
import { extractSlugFromUrl, isLeetCodeProblemUrl } from './url.js';

/**
 * url.ts is a re-export of @codereviewai/shared (see its comment for why);
 * exhaustive behavior coverage lives in packages/shared's own test suite.
 * This just proves the re-export resolves and behaves as expected from
 * within apps/extension.
 */
describe('url.ts re-export', () => {
  it('isLeetCodeProblemUrl works via the re-export', () => {
    expect(isLeetCodeProblemUrl('https://leetcode.com/problems/two-sum/')).toBe(true);
    expect(isLeetCodeProblemUrl('https://leetcode.com/explore/')).toBe(false);
  });

  it('extractSlugFromUrl works via the re-export', () => {
    expect(extractSlugFromUrl('https://leetcode.com/problems/two-sum/')).toBe('two-sum');
    expect(extractSlugFromUrl('https://leetcode.com/explore/')).toBeNull();
  });
});
