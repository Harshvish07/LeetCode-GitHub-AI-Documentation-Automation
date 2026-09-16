/**
 * Deliberately included as an honest gap: this is a textbook Kadane's
 * algorithm, but it neither sorts, mentions "dp"/"memo", nor allocates a
 * table — so it doesn't trip the Dynamic Programming or Greedy signals in
 * pattern-detector/rules/, even though many people categorize Kadane's as
 * one or the other. Pattern detection is heuristic, not perfect; this is a
 * real example of that, not a bug to "fix" by chasing this one fixture.
 */
export const maximumSubarrayFixture = {
  name: 'Maximum Subarray',
  slug: 'maximum-subarray',
  language: 'JavaScript',
  code: `
var maxSubArray = function(nums) {
  let currentSum = nums[0];
  let best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    currentSum = Math.max(nums[i], currentSum + nums[i]);
    best = Math.max(best, currentSum);
  }
  return best;
};
`.trim(),
};
