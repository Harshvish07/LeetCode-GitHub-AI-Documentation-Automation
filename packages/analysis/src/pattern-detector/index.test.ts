import { describe, expect, it } from 'vitest';
import { buildCodeContext } from '../context.js';
import { detectPatterns } from './index.js';

function patternNames(code: string, language: string | null = 'JavaScript') {
  return detectPatterns(buildCodeContext(code, language)).map((m) => m.pattern);
}

describe('detectPatterns', () => {
  it('detects Hash Map from `new Map()` usage', () => {
    const names = patternNames(`
      function twoSum(nums, target) {
        const seen = new Map();
        for (let i = 0; i < nums.length; i++) {
          if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
          seen.set(nums[i], i);
        }
        return [];
      }
    `);
    expect(names).toContain('Hash Map');
  });

  it('detects Hash Set from `new Set()` usage', () => {
    const names = patternNames(`
      function hasDuplicate(nums) {
        const seen = new Set();
        for (const n of nums) {
          if (seen.has(n)) return true;
          seen.add(n);
        }
        return false;
      }
    `);
    expect(names).toContain('Hash Set');
  });

  it('detects Two Pointers from a left/right comparison loop', () => {
    const names = patternNames(`
      function isPalindrome(s) {
        let left = 0;
        let right = s.length - 1;
        while (left < right) {
          if (s[left] !== s[right]) return false;
          left++;
          right--;
        }
        return true;
      }
    `);
    expect(names).toContain('Two Pointers');
  });

  it('detects Binary Search from a midpoint + lo/hi loop', () => {
    const names = patternNames(`
      function search(nums, target) {
        let lo = 0;
        let hi = nums.length - 1;
        while (lo <= hi) {
          const mid = lo + Math.floor((hi - lo) / 2);
          if (nums[mid] === target) return mid;
          if (nums[mid] < target) lo = mid + 1;
          else hi = mid - 1;
        }
        return -1;
      }
    `);
    expect(names).toContain('Binary Search');
  });

  it('detects Stack from push/pop usage', () => {
    const names = patternNames(`
      function isValid(s) {
        const stack = [];
        for (const ch of s) {
          if (ch === '(') stack.push(ch);
          else if (stack.pop() !== '(') return false;
        }
        return stack.length === 0;
      }
    `);
    expect(names).toContain('Stack');
  });

  it('detects Recursion from a self-calling function', () => {
    const names = patternNames(
      'function fib(n) { if (n <= 1) return n; return fib(n - 1) + fib(n - 2); }',
    );
    expect(names).toContain('Recursion');
  });

  it('detects Dynamic Programming from a DP table + memo keyword', () => {
    const names = patternNames(`
      function climbStairs(n) {
        const memo = new Array(n + 1).fill(0);
        memo[0] = 1;
        memo[1] = 1;
        for (let i = 2; i <= n; i++) memo[i] = memo[i - 1] + memo[i - 2];
        return memo[n];
      }
    `);
    expect(names).toContain('Dynamic Programming');
  });

  it('detects Sorting from a sort call', () => {
    const names = patternNames('function f(nums) { return nums.sort((a, b) => a - b); }');
    expect(names).toContain('Sorting');
  });

  it('detects Linked List Techniques from a ListNode type', () => {
    const names = patternNames(`
      function mergeTwoLists(l1, l2) {
        const dummy = new ListNode(0);
        let curr = dummy;
        while (l1 && l2) {
          if (l1.val < l2.val) { curr.next = l1; l1 = l1.next; }
          else { curr.next = l2; l2 = l2.next; }
          curr = curr.next;
        }
        curr.next = l1 || l2;
        return dummy.next;
      }
    `);
    expect(names).toContain('Linked List Techniques');
  });

  it('detects Tree Traversal from a TreeNode type and left/right access', () => {
    const names = patternNames(`
      function maxDepth(root) {
        if (!root) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
      }
    `);
    expect(names).toContain('Tree Traversal');
  });

  it('detects Graph Traversal / DFS on a grid with a visited set', () => {
    const names = patternNames(`
      function numIslands(grid) {
        const visited = new Set();
        function dfs(i, j) {
          if (i < 0 || j < 0 || i >= grid.length || j >= grid[0].length) return;
          const key = i + ',' + j;
          if (visited.has(key) || grid[i][j] === '0') return;
          visited.add(key);
          dfs(i + 1, j);
          dfs(i - 1, j);
          dfs(i, j + 1);
          dfs(i, j - 1);
        }
        let count = 0;
        for (let i = 0; i < grid.length; i++) {
          for (let j = 0; j < grid[0].length; j++) {
            if (grid[i][j] === '1' && !visited.has(i + ',' + j)) {
              dfs(i, j);
              count++;
            }
          }
        }
        return count;
      }
    `);
    expect(names).toContain('DFS');
    expect(names).toContain('Graph Traversal');
  });

  it('returns no patterns for trivial code with no recognizable signals', () => {
    const names = patternNames('function add(a, b) { return a + b; }');
    expect(names).toEqual([]);
  });

  it('reports evidence and a confidence level for every match', () => {
    const matches = detectPatterns(
      buildCodeContext('function f() { const m = new Map(); return m; }', 'JavaScript'),
    );
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.evidence.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(match.confidence.level);
    }
  });
});
