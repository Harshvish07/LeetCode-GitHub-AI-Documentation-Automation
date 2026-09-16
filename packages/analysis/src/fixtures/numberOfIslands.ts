/**
 * True complexity is O(rows * cols): the DFS is bounded by the `visited`
 * set, so every cell is processed a constant number of times overall. This
 * heuristic can't see that amortized bound — it sees an outer nested loop
 * (depth 2) *and* recursion with no matching specific pattern (not DP, not
 * backtracking, not binary search), so it reports "Unknown (mixed loop +
 * recursion)" at low confidence. That is the deterministic, honest output
 * of this analyzer today, not the mathematically true complexity — see
 * docs/phases/phase-04.md for why this is treated as an acceptable,
 * documented limitation rather than special-cased away.
 */
export const numberOfIslandsFixture = {
  name: 'Number of Islands',
  slug: 'number-of-islands',
  language: 'JavaScript',
  code: `
var numIslands = function(grid) {
  const visited = new Set();
  function dfs(row, col) {
    if (row < 0 || col < 0 || row >= grid.length || col >= grid[0].length) return;
    const key = row + ',' + col;
    if (visited.has(key) || grid[row][col] === '0') return;
    visited.add(key);
    dfs(row + 1, col);
    dfs(row - 1, col);
    dfs(row, col + 1);
    dfs(row, col - 1);
  }
  let count = 0;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      if (grid[row][col] === '1' && !visited.has(row + ',' + col)) {
        dfs(row, col);
        count++;
      }
    }
  }
  return count;
};
`.trim(),
};
