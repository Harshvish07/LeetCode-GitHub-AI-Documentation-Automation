import { normalizedSignal, predicateSignal, regexSignal } from '../helpers.js';
import type { PatternRule } from '../types.js';
import { analyzeLoopStructure } from '../../shared/codeStructure.js';

const SORT_CALL = /\.sort\(|Arrays\.sort\(|Collections\.sort\(|\bsorted\(|std::sort\(/;

export const sortingRule: PatternRule = {
  pattern: 'Sorting',
  reportThreshold: 5,
  confidenceCap: 5,
  signals: [regexSignal('calls a sort function/method', 5, SORT_CALL)],
};

export const greedyRule: PatternRule = {
  pattern: 'Greedy',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    normalizedSignal('mentions "greedy" by name', 3, /greedy/),
    predicateSignal(
      'sorts the input, then makes a single unnested pass tracking a running best/result',
      2,
      (ctx) => SORT_CALL.test(ctx.code) && analyzeLoopStructure(ctx).maxNestingDepth <= 1,
    ),
  ],
};

export const heapRule: PatternRule = {
  pattern: 'Heap / Priority Queue',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal('constructs a `PriorityQueue`', 3, /\bPriorityQueue\s*[<(]/),
    regexSignal("imports/uses Python's `heapq`", 3, /\bheapq\b/),
    regexSignal('declares a `priority_queue<`', 3, /\bpriority_queue\s*</),
    normalizedSignal('names a variable "heap" (min-heap/max-heap)', 1, /\bheap\b/),
  ],
};

export const linkedListRule: PatternRule = {
  pattern: 'Linked List Techniques',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal(
      "operates on a `ListNode` type (LeetCode's standard linked-list node)",
      3,
      /\bListNode\b/,
    ),
    regexSignal('accesses a `.next` field', 2, /\.next\b/),
    regexSignal(
      'a fast/slow pointer pair advances at different rates (`fast.next.next`, `fast = fast.next.next`)',
      3,
      /\bfast\b[\s\S]{0,150}?\.next\s*\.\s*next/,
    ),
  ],
};

export const STRUCTURE_AND_STRATEGY_RULES: PatternRule[] = [
  sortingRule,
  greedyRule,
  heapRule,
  linkedListRule,
];
