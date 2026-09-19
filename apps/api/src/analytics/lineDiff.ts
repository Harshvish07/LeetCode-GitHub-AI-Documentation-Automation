export interface LineDiff {
  added: number;
  removed: number;
  identical: boolean;
}

/** Beyond this many lines a side is compared as a multiset instead of by longest common subsequence. */
const LCS_LINE_CAP = 1500;

function toLines(code: string): string[] {
  return code
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * How many lines were added and removed going from `before` to `after`.
 * Whitespace-only differences (indentation, blank lines) don't count — a
 * reformat is not a change of solution. Uses a longest-common-subsequence
 * so a moved-and-edited block is counted honestly; very large inputs fall
 * back to a line-frequency comparison, which can under-count reordering.
 */
export function diffLines(before: string, after: string): LineDiff {
  const a = toLines(before);
  const b = toLines(after);

  let common: number;
  if (a.length > LCS_LINE_CAP || b.length > LCS_LINE_CAP) {
    const counts = new Map<string, number>();
    for (const line of a) counts.set(line, (counts.get(line) ?? 0) + 1);
    common = 0;
    for (const line of b) {
      const remaining = counts.get(line) ?? 0;
      if (remaining > 0) {
        common += 1;
        counts.set(line, remaining - 1);
      }
    }
  } else {
    let previous = new Array<number>(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i += 1) {
      const current = new Array<number>(b.length + 1).fill(0);
      for (let j = 1; j <= b.length; j += 1) {
        current[j] =
          a[i - 1] === b[j - 1] ? previous[j - 1]! + 1 : Math.max(previous[j]!, current[j - 1]!);
      }
      previous = current;
    }
    common = previous[b.length]!;
  }

  const removed = a.length - common;
  const added = b.length - common;
  return { added, removed, identical: added === 0 && removed === 0 };
}
