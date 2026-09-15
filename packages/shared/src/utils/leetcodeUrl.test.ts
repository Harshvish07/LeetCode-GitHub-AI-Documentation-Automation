import { describe, expect, it } from 'vitest';
import { extractSlugFromUrl, isLeetCodeProblemUrl } from './leetcodeUrl.js';

describe('isLeetCodeProblemUrl', () => {
  it('recognizes a plain problem page URL', () => {
    expect(isLeetCodeProblemUrl('https://leetcode.com/problems/two-sum/')).toBe(true);
  });

  it('recognizes a problem page URL with a sub-path (description/submissions)', () => {
    expect(isLeetCodeProblemUrl('https://leetcode.com/problems/two-sum/description/')).toBe(true);
    expect(isLeetCodeProblemUrl('https://leetcode.com/problems/two-sum/submissions/123456/')).toBe(
      true,
    );
  });

  it('recognizes a www. subdomain', () => {
    expect(isLeetCodeProblemUrl('https://www.leetcode.com/problems/two-sum/')).toBe(true);
  });

  it('rejects non-problem LeetCode pages', () => {
    expect(isLeetCodeProblemUrl('https://leetcode.com/explore/')).toBe(false);
    expect(isLeetCodeProblemUrl('https://leetcode.com/discuss/')).toBe(false);
    expect(isLeetCodeProblemUrl('https://leetcode.com/')).toBe(false);
  });

  it('rejects lookalike domains', () => {
    expect(isLeetCodeProblemUrl('https://notleetcode.com/problems/two-sum/')).toBe(false);
    expect(isLeetCodeProblemUrl('https://leetcode.com.evil.example/problems/two-sum/')).toBe(false);
  });

  it('rejects malformed URLs instead of throwing', () => {
    expect(isLeetCodeProblemUrl('not-a-url')).toBe(false);
    expect(isLeetCodeProblemUrl('')).toBe(false);
  });
});

describe('extractSlugFromUrl', () => {
  it('extracts the slug from a plain problem page URL', () => {
    expect(extractSlugFromUrl('https://leetcode.com/problems/two-sum/')).toBe('two-sum');
  });

  it('extracts the slug when a sub-path follows', () => {
    expect(extractSlugFromUrl('https://leetcode.com/problems/two-sum/description/')).toBe(
      'two-sum',
    );
  });

  it('extracts a hyphenated slug', () => {
    expect(extractSlugFromUrl('https://leetcode.com/problems/longest-common-subsequence/')).toBe(
      'longest-common-subsequence',
    );
  });

  it('returns null for a non-problem URL', () => {
    expect(extractSlugFromUrl('https://leetcode.com/explore/')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(extractSlugFromUrl('not-a-url')).toBeNull();
  });
});
