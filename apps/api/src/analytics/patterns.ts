import { TRACKED_PATTERNS, type TrackedPattern } from '@codereviewai/shared';

/**
 * Maps the free-text pattern names produced by static analysis ("Heap /
 * Priority Queue", "Graph Traversal") and by the AI ("Hashing", "Depth-First
 * Search", "Brute Force") onto the fixed set the dashboard tracks. Order
 * matters — the first matching rule wins — so the more specific rules
 * ("binary search tree", "priority queue") sit before the general ones
 * ("binary search", "queue"). Anything unmatched ("Recursion", "Brute
 * Force", "Linked List Techniques") returns `null`: it's simply not one of
 * the tracked patterns, never guessed into one.
 */
const RULES: Array<[RegExp, TrackedPattern]> = [
  [/binary search tree|\bbst\b|\btrie\b|\btree\b/, 'Tree'],
  [/hash|dictionary|frequency (map|count)|\bcounter\b/, 'Hash Map'],
  [/two[\s-]*pointer|fast\s*(and|&|\/)\s*slow|slow\s*(and|&|\/)\s*fast/, 'Two Pointers'],
  [/sliding[\s-]*window/, 'Sliding Window'],
  [/binary[\s-]*search|bisect/, 'Binary Search'],
  [/heap|priority[\s-]*queue/, 'Heap'],
  [/\bbfs\b|breadth/, 'BFS'],
  [/\bdfs\b|depth[\s-]*first/, 'DFS'],
  [/\bstack\b|monotonic/, 'Stack'],
  [/\bqueue\b|deque/, 'Queue'],
  [/greedy/, 'Greedy'],
  [/backtrack/, 'Backtracking'],
  [/dynamic[\s-]*programming|\bdp\b|memoi[sz]ation|tabulation/, 'Dynamic Programming'],
  [/graph|topological|union[\s-]*find|disjoint/, 'Graph'],
  [/prefix[\s-]*sum|cumulative[\s-]*sum|running[\s-]*sum/, 'Prefix Sum'],
  [/sort/, 'Sorting'],
];

export function normalizePattern(raw: string): TrackedPattern | null {
  const text = raw.trim().toLowerCase();
  if (text.length === 0) return null;
  for (const [rule, pattern] of RULES) {
    if (rule.test(text)) return pattern;
  }
  return null;
}

/** Normalizes many raw names into a de-duplicated list in the dashboard's fixed display order. */
export function normalizePatterns(raws: Iterable<string>): TrackedPattern[] {
  const found = new Set<TrackedPattern>();
  for (const raw of raws) {
    const pattern = normalizePattern(raw);
    if (pattern) found.add(pattern);
  }
  return TRACKED_PATTERNS.filter((pattern) => found.has(pattern));
}

/**
 * Every tracked pattern mentioned anywhere in a piece of free text (e.g. the
 * AI's description of a better approach). Unlike `normalizePattern`, all
 * rules apply — a sentence can name several patterns. It is keyword
 * matching on stored text, so a mention is a hint, not a proof; callers say so.
 */
export function findPatternsInText(text: string): TrackedPattern[] {
  const lower = text.toLowerCase();
  const found = new Set<TrackedPattern>();
  for (const [rule, pattern] of RULES) {
    if (rule.test(lower)) found.add(pattern);
  }
  return TRACKED_PATTERNS.filter((pattern) => found.has(pattern));
}
