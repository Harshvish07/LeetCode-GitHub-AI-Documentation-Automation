/**
 * Re-exported from @codereviewai/shared (moved there in Phase 3 so apps/api
 * can validate a submitted problem URL with the exact same check, instead
 * of re-implementing — and risking drifting from — the same regex twice).
 * Exhaustive behavior tests now live in packages/shared; see
 * apps/extension/src/content/leetcode/url.test.ts for a smoke test only.
 */
export { isLeetCodeProblemUrl, extractSlugFromUrl } from '@codereviewai/shared';
