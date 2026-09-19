/**
 * Big-O notations ordered by growth rate, cheapest first. Anything not in
 * this list (`O(n + m)`, `O(m * n)`, `Unknown`) has no rank — callers must
 * treat that as "can't compare", never guess an order.
 */
const GROWTH_ORDER = [
  'o(1)',
  'o(logn)',
  'o(sqrtn)',
  'o(n)',
  'o(nlogn)',
  'o(n^2)',
  'o(n^3)',
  'o(2^n)',
  'o(n!)',
];

export type ComplexityDirection = 'improved' | 'regressed' | 'same' | 'unknown';

function normalize(notation: string): string {
  return notation
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/o\(n\*n\)/, 'o(n^2)')
    .replace(/o\(sqrt\(n\)\)/, 'o(sqrtn)')
    .replace(/o\(√n\)/, 'o(sqrtn)');
}

/** Position in the growth order (0 = O(1)), or `null` when the notation isn't a recognized single-variable form. */
export function complexityGrowthRank(notation: string | null | undefined): number | null {
  if (!notation) return null;
  const index = GROWTH_ORDER.indexOf(normalize(notation));
  return index === -1 ? null : index;
}

/**
 * Did the complexity get better going from `from` to `to`? `unknown` when
 * either side isn't a recognized notation — an unrecognized notation is
 * never treated as better or worse than a recognized one.
 */
export function compareComplexity(
  from: string | null | undefined,
  to: string | null | undefined,
): ComplexityDirection {
  const a = complexityGrowthRank(from);
  const b = complexityGrowthRank(to);
  if (a === null || b === null) return 'unknown';
  if (b < a) return 'improved';
  if (b > a) return 'regressed';
  return 'same';
}
