export const longestSubstringWithoutRepeatingFixture = {
  name: 'Longest Substring Without Repeating Characters',
  slug: 'longest-substring-without-repeating-characters',
  language: 'JavaScript',
  code: `
var lengthOfLongestSubstring = function(s) {
  const seen = new Set();
  let left = 0;
  let maxLen = 0;
  for (let right = 0; right < s.length; right++) {
    while (seen.has(s[right])) {
      seen.delete(s[left]);
      left++;
    }
    seen.add(s[right]);
    maxLen = Math.max(maxLen, right - left + 1);
  }
  return maxLen;
};
`.trim(),
};
