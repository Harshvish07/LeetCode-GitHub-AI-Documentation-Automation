import { regexSignal } from '../helpers.js';
import type { PatternRule } from '../types.js';

export const hashMapRule: PatternRule = {
  pattern: 'Hash Map',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal('constructs a `new Map(`', 3, /\bnew\s+Map\s*\(/),
    regexSignal('declares a `HashMap<`', 3, /\bHashMap\s*</),
    regexSignal('declares an `unordered_map<`', 3, /\bunordered_map\s*</),
    regexSignal('constructs a `defaultdict(`', 3, /\bdefaultdict\s*\(/),
    regexSignal('constructs a `dict()`', 2, /\bdict\s*\(\s*\)/),
    regexSignal('declares a `Map<...>` type', 2, /\bMap\s*<[^>]*>/),
    regexSignal(
      'uses `.getOrDefault(` / `.containsKey(` / `.put(`',
      2,
      /\.getOrDefault\(|\.containsKey\(|\.put\(/,
    ),
    regexSignal('uses map-style `.get(`/`.set(`/`.has(` calls', 1, /\.get\(|\.set\(|\.has\(/),
  ],
};

export const hashSetRule: PatternRule = {
  pattern: 'Hash Set',
  reportThreshold: 3,
  confidenceCap: 5,
  signals: [
    regexSignal('constructs a `new Set(`', 3, /\bnew\s+Set\s*\(/),
    regexSignal('declares a `HashSet<`', 3, /\bHashSet\s*</),
    regexSignal('declares an `unordered_set<`', 3, /\bunordered_set\s*</),
    regexSignal('constructs a `set()`', 2, /\bset\s*\(\s*\)/),
    regexSignal('declares a `Set<...>` type', 2, /\bSet\s*<[^>]*>/),
    regexSignal(
      'uses `.add(` alongside `.has(`/`in`-style membership checks',
      2,
      /\.add\([\s\S]*?\.has\(|\.has\([\s\S]*?\.add\(/,
    ),
  ],
};

export const HASHING_RULES: PatternRule[] = [hashMapRule, hashSetRule];
