import { detectRecursion } from '../../shared/codeStructure.js';
import { normalizedSignal, predicateSignal, regexSignal } from '../helpers.js';
import type { PatternRule } from '../types.js';

const VISITED_SIGNAL = /\bvisited\b|\bseen\b/i;

export const bfsRule: PatternRule = {
  pattern: 'BFS',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal('mentions "bfs" / "breadth" by name', 3, /\bbfs\b|breadth/),
    regexSignal(
      'a FIFO structure (`.shift()`/`.popleft()`/`Queue<`) is used alongside a "visited" tracker',
      3,
      new RegExp(
        `(\\.shift\\(\\)|\\.popleft\\(\\)|Queue\\s*<)[\\s\\S]{0,400}?(${VISITED_SIGNAL.source})|(${VISITED_SIGNAL.source})[\\s\\S]{0,400}?(\\.shift\\(\\)|\\.popleft\\(\\)|Queue\\s*<)`,
        'i',
      ),
    ),
    normalizedSignal(
      'tracks a traversal "level"/"depth" counter alongside a queue',
      1,
      /\blevel\b/,
    ),
  ],
};

export const dfsRule: PatternRule = {
  pattern: 'DFS',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal('mentions "dfs" / "depth-first" by name', 3, /\bdfs\b|depth[\s-]?first/),
    predicateSignal(
      'recursive traversal alongside a "visited" tracker',
      3,
      (ctx) => detectRecursion(ctx).isRecursive && VISITED_SIGNAL.test(ctx.code),
    ),
    regexSignal(
      'an explicit stack (`.push(`/`.pop()`) is used alongside a "visited" tracker',
      2,
      new RegExp(
        `\\.push\\([^)]*\\)[\\s\\S]{0,300}?\\.pop\\(\\)[\\s\\S]{0,300}?(${VISITED_SIGNAL.source})`,
        'i',
      ),
    ),
  ],
};

export const treeTraversalRule: PatternRule = {
  pattern: 'Tree Traversal',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal("operates on a `TreeNode` type (LeetCode's standard tree node)", 3, /\bTreeNode\b/),
    regexSignal(
      "accesses both `.left` and `.right` child fields (a binary-tree-node shape most other structures don't have)",
      3,
      /\.left\b[\s\S]{0,200}?\.right\b|\.right\b[\s\S]{0,200}?\.left\b/,
    ),
    normalizedSignal(
      'mentions "inorder"/"preorder"/"postorder" traversal by name',
      2,
      /inorder|preorder|postorder/,
    ),
  ],
};

export const graphTraversalRule: PatternRule = {
  pattern: 'Graph Traversal',
  reportThreshold: 2,
  confidenceCap: 4,
  signals: [
    normalizedSignal(
      'names a variable "graph"/"adjacency"/"adjlist"',
      2,
      /\bgraph\b|\badjacen|\badj(list|_list)?\b/,
    ),
    regexSignal(
      'accesses a grid via `grid[i][j]`-shaped 2D indexing',
      2,
      /\w+\[[^\]]+\]\[[^\]]+\]/,
    ),
    predicateSignal(
      'traversal-style code (recursion or an explicit queue/stack) alongside a "visited" tracker, outside a tree-specific shape',
      1,
      (ctx) =>
        VISITED_SIGNAL.test(ctx.code) &&
        (detectRecursion(ctx).isRecursive || /\.push\(|\.shift\(\)|\.popleft\(\)/.test(ctx.code)),
    ),
  ],
};

export const TRAVERSAL_RULES: PatternRule[] = [
  bfsRule,
  dfsRule,
  treeTraversalRule,
  graphTraversalRule,
];
