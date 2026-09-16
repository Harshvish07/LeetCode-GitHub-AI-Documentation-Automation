import { regexSignal } from '../helpers.js';
import type { PatternRule } from '../types.js';

export const stackRule: PatternRule = {
  pattern: 'Stack',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal('constructs a `new Stack(`', 3, /\bnew\s+Stack\s*\(/),
    regexSignal('declares a `Stack<`', 3, /\bStack\s*</),
    regexSignal(
      'uses last-in-first-out `.push(`/`.pop()` on the same collection',
      2,
      /\.push\([^)]*\)[\s\S]{0,200}?\.pop\(\)/,
    ),
    regexSignal(
      'array literal used with `.push(`/`.pop()` (JS array-as-stack idiom)',
      1,
      /\[\s*\][\s\S]{0,150}?\.push\(/,
    ),
  ],
};

export const queueRule: PatternRule = {
  pattern: 'Queue',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal('declares a `Queue<`', 3, /\bQueue\s*</),
    regexSignal('constructs a `deque(`/`collections.deque`', 3, /\bdeque\s*\(/),
    regexSignal('uses `.popleft()` (Python deque FIFO removal)', 3, /\.popleft\(\)/),
    regexSignal('uses `.shift()` (JS array-as-queue FIFO removal)', 2, /\.shift\(\)/),
    regexSignal('constructs a `LinkedList<` (common Java queue backing)', 1, /\bLinkedList\s*</),
  ],
};

export const LINEAR_STRUCTURE_RULES: PatternRule[] = [stackRule, queueRule];
