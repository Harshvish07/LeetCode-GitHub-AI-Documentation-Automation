/**
 * Pure LeetCode URL parsing — no DOM access, so it's cheap to unit test and
 * safe to share between apps/extension (which uses it to detect a problem
 * page) and apps/api (which uses the same check to validate a submitted
 * problem URL server-side, rather than re-implementing — and risking
 * drifting from — the same regex twice).
 */
const PROBLEM_PATH_PATTERN = /^\/problems\/([a-z0-9-]+)\/?/i;

function isLeetCodeHostname(hostname: string): boolean {
  return hostname === 'leetcode.com' || hostname.endsWith('.leetcode.com');
}

export function isLeetCodeProblemUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return isLeetCodeHostname(url.hostname) && PROBLEM_PATH_PATTERN.test(url.pathname);
  } catch {
    return false;
  }
}

export function extractSlugFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const match = PROBLEM_PATH_PATTERN.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
