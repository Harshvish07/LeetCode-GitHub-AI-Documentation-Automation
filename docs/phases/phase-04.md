# Phase 4 — Deterministic Solution-Analysis Engine

## Objective

Build a deterministic (non-AI) solution-analysis engine that inspects a submitted DSA
solution's source code and extracts as much objective information as possible before any AI
is introduced: which algorithmic patterns it likely uses, an estimated time/space complexity,
code-quality observations, and edge-case robustness concerns — every output carrying an
explicit confidence level, since none of this is a proof. No AI, no new API endpoint wiring,
no extension changes — this phase is the engine itself, standalone and thoroughly tested.

## Implementation Summary

- A new workspace package, `packages/analysis` (`@codereviewai/analysis`), containing the
  entire engine: `pattern-detector/`, `complexity-analyzer/`, `code-review/`,
  `edge-case-analyzer/`, and the `solution-analyzer.ts` orchestrator that combines them into
  one `SolutionAnalysis` result.
- A modular, signal-based pattern detector recognizing all 19 requested patterns (Hash Map,
  Hash Set, Two Pointers, Sliding Window, Binary Search, Stack, Queue, BFS, DFS, Recursion,
  Backtracking, Heap/Priority Queue, Greedy, Dynamic Programming, Prefix Sum, Sorting, Linked
  List Techniques, Tree Traversal, Graph Traversal), each match carrying its own confidence
  level and a list of plain-language evidence strings.
- A heuristic complexity analyzer that reasons from loop-nesting depth, recursion, and the
  patterns already detected (sorting, binary search, DP, backtracking, sliding window) to
  estimate time and space complexity — explicitly distinguishing this *static estimate* from
  the *actual* runtime/memory LeetCode reports (see [docs/api.md](../api.md); `StoredSubmission
  .submission.runtime`/`.memory` remain untouched by this phase).
- A code-quality reviewer flagging nested loops, repeated computation, non-descriptive naming,
  duplicated lines, wasteful type conversions, in-place mutation of input parameters, and
  readability issues.
- An edge-case analyzer flagging missing empty-input guards, missing null checks on
  linked-list/tree entry points, offset array accesses, unchecked set insertions, and
  recursive functions with no visible base case.
- Shared structural primitives (`shared/codeStructure.ts`) — loop-nesting depth analysis and
  function/recursion detection — used by every sub-analyzer, so "how deep are the loops" and
  "does this function call itself" are each computed once and agreed on everywhere.
- Fixtures for all 7 requested problems (Two Sum, Valid Parentheses, Binary Search, Longest
  Substring Without Repeating Characters, Maximum Subarray, Merge Two Sorted Lists, Number of
  Islands), each exercised through the full `analyzeSolution()` pipeline in tests.
- **101 tests** for this phase alone (`packages/analysis` totals 73 test cases across 6 test
  files, some of which assert multiple expectations), for **164 tests repo-wide**.
- Not implemented, per explicit scope: no AI call anywhere, no new HTTP endpoint, no extension
  UI changes. See [What Phase 5 Will Implement](#what-phase-5-will-implement).

## Architecture

```
packages/analysis/src/
├── types.ts                     Top-level SolutionAnalysis, Confidence, and shared enums
├── context.ts                    CodeContext + buildCodeContext()
├── shared/
│   ├── codeStructure.ts           Loop-nesting analysis + function/recursion detection
│   └── codeStructure.test.ts
├── pattern-detector/
│   ├── types.ts                    Signal, PatternRule interfaces
│   ├── engine.ts                    evaluatePatternRule() — signals → a report decision + confidence
│   ├── helpers.ts                    regexSignal/normalizedSignal/predicateSignal builders
│   ├── rules/                         One file per related group of patterns (6 files, see below)
│   ├── index.ts                        detectPatterns() — runs every rule, sorts by confidence
│   └── index.test.ts
├── complexity-analyzer/
│   ├── index.ts                    estimateComplexity() — time + space heuristics
│   └── index.test.ts
├── code-review/
│   ├── index.ts                    reviewCodeQuality() — style/maintainability checks
│   └── index.test.ts
├── edge-case-analyzer/
│   ├── index.ts                    analyzeEdgeCases() — input-robustness checks
│   └── index.test.ts
├── solution-analyzer.ts             analyzeSolution() — the one public orchestrator
├── solution-analyzer.test.ts
└── fixtures/                        One file per required problem + an index re-exporting all 7
```

Every sub-analyzer is a plain function taking a `CodeContext` (and, where relevant, already-
computed `LoopStructure`/`RecursionInfo`/`PatternMatch[]`) and returning its own typed output —
there's no shared mutable state, no class hierarchy, and no sub-analyzer calls another directly
except through `solution-analyzer.ts`, which computes the shared primitives once and passes them
down. Interfaces (`Signal`, `PatternRule`, `SubmissionRepository`-style dependency shapes) are
used specifically so a new pattern rule or a whole new analyzer module can be added later without
changing this shape — see [Extending this later](#extending-this-later).

### A deliberate deviation from the task's example tree

The task's example showed `analysis/` as a bare top-level folder. This implementation makes it
its own npm workspace package, `packages/analysis`, instead of a folder inside `apps/api/src/`.
Reasoning: the engine has zero dependency on Express, HTTP, or any runtime concern specific to
the API process — it's pure functions over strings — and a later phase (the AI layer, or
`apps/web` rendering a result) may want to import it directly without pulling in the whole API
app. Making it a package (matching `packages/shared`'s existing precedent from Phase 1) keeps
that door open for free. It is **not yet a dependency of any other workspace** — see
[What Phase 5 Will Implement](#what-phase-5-will-implement) for why it's wired up later, not now.

## Pattern Detection

### The confidence model

Every `PatternRule` (`pattern-detector/types.ts`) is a list of independently-testable `Signal`s,
each with a `weight` and a plain-language `description`. Most signals within one rule are
**alternatives**, not independent corroborating evidence: `new Map(`, `HashMap<`, and
`unordered_map<` are the same construct in three different languages, and a single-language
submission can only ever trigger one of them. An earlier version of this engine normalized
confidence as "matched weight ÷ every signal's weight in the rule" — that systematically
under-reported confidence for every real match, since no single-language submission can ever hit
more than one or two of a rule's many language-specific alternatives. This was caught during
Phase 4's own testing (see the `git` history for `pattern-detector/types.ts`/`engine.ts`) and
replaced with the model actually implemented:

- **`reportThreshold`** — the minimum combined weight of matched signals for the pattern to be
  reported *at all*, typically set to the weight of one strong, unambiguous signal (e.g. seeing
  `new Map(` literally in the source).
- **`confidenceCap`** — the matched weight that counts as *maximum* confidence;
  `score = min(1, matchedWeight / confidenceCap)`. One strong signal alone lands in the middle
  of the confidence range (0.5–0.6); an *additional*, genuinely corroborating signal (e.g. a
  generic `.get()`/`.set()` API-shape hint layered on top of the explicit `new Map(`) pushes the
  score toward 1.0 ("high").

A pattern that doesn't clear `reportThreshold` isn't returned at all — not returned with "low"
confidence. Below-threshold evidence isn't meaningfully distinguishable from noise, so it's
simply omitted rather than cluttering the result with speculative near-matches.

### The rule groups (`pattern-detector/rules/`)

| File | Patterns | Representative signals |
| --- | --- | --- |
| `hashing.ts` | Hash Map, Hash Set | `new Map(`/`HashMap<`/`unordered_map<`/`defaultdict(`/`dict()`; `new Set(`/`HashSet<`/`unordered_set<`/`set()` |
| `pointers.ts` | Two Pointers, Sliding Window, Binary Search, Prefix Sum | a loop condition comparing `left`/`right`-style variables; a midpoint computation (`mid = lo + (hi - lo) / 2`); a running-total self-referential array assignment (`prefix[i] = prefix[i-1] + ...`) |
| `linearStructures.ts` | Stack, Queue | `.push(`/`.pop()` on the same collection; `.shift()`/`.popleft()`/`deque(`/`Queue<` |
| `traversal.ts` | BFS, DFS, Tree Traversal, Graph Traversal | a FIFO structure alongside a "visited" tracker (BFS); recursion alongside a "visited" tracker (DFS); both `.left` and `.right` child-field access (Tree); `grid[i][j]`-shaped 2D indexing alongside traversal (Graph) |
| `recursionFamily.ts` | Recursion, Backtracking, Dynamic Programming | a function calling itself by name; a recursive call followed by an "undo" (`.pop()`/`.removeLast(`) in a loop; a fixed-size table allocation (`new int[n+1]`, `[0] * n`) |
| `structuresAndStrategy.ts` | Sorting, Greedy, Heap/Priority Queue, Linked List Techniques | a sort call; sorting followed by a single unnested pass; `PriorityQueue`/`heapq`/`priority_queue<`; a `ListNode` type or a `fast.next.next` fast/slow pointer shape |

`detectPatterns()` (`pattern-detector/index.ts`) runs every rule from every group against the
same `CodeContext` and returns every match that cleared its threshold, sorted by confidence
score — **not mutually exclusive**: a real solution routinely matches more than one pattern (a
Two Sum-style hash map solution is *only* Hash Map, but a sliding-window substring solution is
both Sliding Window *and* Hash Set).

### What this cannot do (and doesn't pretend to)

- It has no AST and no execution — every signal is a regex or a small structural heuristic over
  the source text (see `shared/codeStructure.ts` below), so it can be fooled by unusual
  formatting, an unconventional variable name, or code that happens to resemble a pattern by
  coincidence.
- Functional iteration (`.forEach(`, `.map(`, `.filter(`) is not recognized as a loop for
  nesting-depth purposes — only `for`/`while`/`do-while` (and Python's indentation-based `for`/
  `while`). A solution written with `.map()`/`.reduce()` instead of explicit loops will report a
  lower loop-nesting depth than it structurally has.
- A regex expecting a single balanced pair of parens (e.g. matching a `while(...)` condition)
  can be fooled by a nested function call inside that condition (`while (seen.has(x))`) — this
  was a real bug caught in this phase's own test-writing (the Sliding Window structural signal
  originally failed on exactly this shape) and fixed by switching that one signal from a single
  regex to a plain substring-search predicate (see `pointers.ts`'s `slidingWindowRule`). Other
  signals with the same `[^)]*` shape (see `linearStructures.ts`, `traversal.ts`) were not
  individually re-verified against every possible nested-call shape and may have the same
  narrower blind spot — documented here rather than silently left as an unstated assumption.

## Complexity Analysis

`complexity-analyzer/index.ts` inspects (via `shared/codeStructure.ts`, computed once in
`solution-analyzer.ts` and passed in): loop nesting depth, recursion, and the already-detected
patterns (sorting, binary search, sliding window, DP, backtracking). It is explicitly a
**heuristic estimator**, not a prover — `reasoning: string[]` on every `ComplexityEstimate`
always states exactly which signals drove the result, and confidence is intentionally
conservative whenever signals are sparse or could plausibly combine in more than one way.

### Time complexity — the decision path

1. **No recursion** → base the estimate on loop nesting depth (`analyzeLoopStructure`):
   depth 0 → `O(1)` (or `O(n log n)` if a sort call was found with no loop); depth 1 → `O(n)`
   (or `O(log n)` if it's a binary-search-shaped loop, or `O(n log n)` if paired with a sort);
   depth 2 → `O(n^2)` — **unless** the Sliding Window pattern was also detected, in which case
   this is overridden to amortized `O(n)` (see below); depth 3+ → `O(n^k)`, low confidence.
2. **Recursion present** → checked against the already-detected patterns, in order: Binary
   Search recursion → `O(log n)`; Backtracking → `O(2^n)` (exponential, explicitly labeled
   "problem-dependent", low confidence); Dynamic Programming → `O(n)` or `O(n * m)` depending on
   whether a 1D or 2D table was detected; otherwise, if loops are *also* present with no
   explaining pattern → `"Unknown (mixed loop + recursion)"`, low confidence, with reasoning
   explicitly stating this heuristic cannot tell whether they combine multiplicatively or the
   loop is simply inside the recursive function; otherwise (recursion, no loops) → a rough
   `O(n)` guess, low confidence.

**The Sliding Window override** is the one case where a more specific pattern match overrides
the generic loop-nesting guess: a `while` loop nested inside a `for` loop naively counts as
nesting depth 2 (→ `O(n^2)`), but the classic sliding-window shape (`for (right...) { while
(shrink-condition) { left++ } }`) is amortized `O(n)`, since each pointer only ever moves
forward across the whole input. This is deliberately flagged as **medium**, not high, confidence
— it trusts the pattern match rather than proving the amortized bound directly, and is exactly
the kind of case a plain nesting-depth count gets wrong. This override, and the test that caught
the underlying regex bug enabling it, are documented together in
[Test Fixtures](#test-fixtures) below (Longest Substring Without Repeating Characters).

### Space complexity — the decision path

Starts from `O(1)` and is raised, independently, by: a detected DP table (1D → `O(n)`, 2D →
`O(n * m)`); a detected Hash Map/Hash Set (`O(n)`, "if it grows with the input"); a detected
Stack/Queue (`O(n)`, same caveat — added specifically because Valid Parentheses' stack is
exactly this case, and an earlier version of this analyzer didn't attribute it, defaulting to
the wrong `O(1)`); a detected extra array/list allocation not covered by the above; and,
separately, the recursive call stack itself (`O(log n)` for a detected binary-search recursion,
otherwise up to `O(n)` if recursion depth could scale with the input).

## Code Quality (`code-review/index.ts`)

Seven checks, each conservative by design — it's better to miss a real issue than confidently
flag a false one, so every detector fires only on a fairly explicit textual signal:

| Category | What triggers it |
| --- | --- |
| `nested-loops` | 3+ levels of loop nesting (warning); or 2 levels co-occurring with hash map/set operations, suggesting one loop could be replaced by a hash lookup (info) |
| `repeated-computation` | The same non-trivial call-like expression appears 3+ times (excluding common logging calls) |
| `naming` | A `const`/`let`/`var` declares a single-letter name outside the common loop-counter whitelist (`i, j, k, n, m, x, y`) |
| `duplication` | The same non-trivial source line (15+ characters, trimmed) appears verbatim 2+ times |
| `conversion` | A small curated list of known wasteful round-trip conversions (e.g. `parseInt(x.toString())`, a no-op `.toString().split('').join('')`) |
| `mutation` | The primary function's first parameter is mutated in place (`.sort(`, `.reverse(`, `.push(`, a direct index assignment, ...) with no apparent copy (`[...x]`, `.slice()`, `list(x)`, ...) made first |
| `readability` | Any line exceeding 120 characters |

"Suspicious edge cases" was in the task's Code Quality list too, but this implementation
deliberately routes anything edge-case-shaped to the dedicated `edge-case-analyzer` module
instead of duplicating it here — see the next section — to avoid two analyzers producing
overlapping or conflicting findings about the same underlying concern.

## Edge-Case Observations (`edge-case-analyzer/index.ts`)

Five checks, distinct from code-review's style focus — every one is about "does this code look
like it accounts for a particular input shape," inferred from the *absence* of a textual guard,
which is never proof the edge case is actually mishandled, only that no handling was detected:

- **Empty input** — a loop exists but no length/size/empty guard (`.length === 0`, `len(x) ==
  0`, `if not x:`, `.empty()`, `.isEmpty()`) was found anywhere.
- **Null/empty node input** — a Linked List or Tree pattern was detected, but no null-style
  guard (`!head`, `head == null`, `head is None`, `not head`, ...) on the primary function's
  first parameter was found. (An earlier version of this check only looked for the guard
  *after* the parameter name in the source, which misses the extremely common `if (!head)`
  idiom — the negation comes *before* the name. Caught by this phase's own tests and fixed to
  check both orderings; see `hasNullGuardForParam`.)
- **Offset array access** — an adjacent-index access (`arr[i + 1]`) was found; a prompt to
  verify bounds on small inputs, not a confirmed bug.
- **Duplicate handling** — a Hash Set/Map pattern was detected, `.add(` is used, but no
  `.has(` membership check appears anywhere in the source.
- **Recursion base case** — a self-calling function has no `if` anywhere in its body *before*
  its first recursive call.

## The Top-Level Result (`solution-analyzer.ts`)

`analyzeSolution({ code, language })` is the package's one public entry point. It builds the
`CodeContext` once, runs every sub-analyzer, and assembles:

- **`algorithmCharacteristics`** — booleans/counts derived directly from the shared structural
  primitives (`usesRecursion`, `usesIteration`, `maxLoopNestingDepth`, `usesSorting`,
  `usesHashing`, `usesExtraLinearStructure`).
- **`possibleIssues`** — a short, synthesized "check these first" digest, distinct from
  `codeQualityObservations`/`edgeCaseObservations` (which list *everything* each analyzer
  found): only warning-severity findings from code-review and edge-case-analyzer, plus a
  complexity estimate specifically called out when its notation contains `"Unknown"`/`"2^n"` or
  its own confidence is low. Capped at 6 entries so this stays a digest, not a restatement of
  the full analysis.
- **`confidence`** — the analyzer's own honest summary of the *whole* analysis: the average of
  every detected pattern's confidence score plus the time and space complexity confidence
  scores. Zero detected patterns is itself informative (this code didn't match anything this
  heuristic recognizes) and correctly pulls the average down — but see the important caveat in
  [Confidence Model](#confidence-model) below: this is *not* the same claim as "we're unsure
  what this code does."

## Confidence Model

Every `Confidence` value (`{ level: 'low'|'medium'|'high', score: number, reason: string }`)
appears at three levels: per pattern match, per complexity estimate (time and space
separately), and once as the analysis's overall `confidence`. A subtlety surfaced while writing
this phase's own tests, worth stating explicitly: **zero detected patterns does not by itself
mean low confidence.** `function add(a, b) { return a + b; }` matches no pattern at all, but its
`O(1)` time-complexity estimate is reported at **high** confidence — straight-line code with no
loops or recursion is genuinely reliable evidence for `O(1)`. The overall `confidence` for that
example lands at "high" too, correctly reflecting that the *complexity* claim is solid even
though there's no *algorithm pattern* to name. Low overall confidence is reserved for cases
where the underlying signals are actually sparse or conflicting — e.g. the "mixed loop +
recursion, no explaining pattern" case, or a pattern match that only barely cleared its
`reportThreshold`.

## Every Important File

### `packages/analysis/src/types.ts`

The top-level type vocabulary every other file in the package imports: `Confidence`,
`ConfidenceLevel`, `ALGORITHM_PATTERNS`/`AlgorithmPattern`, `PatternMatch`, `ComplexityEstimate`,
`AlgorithmCharacteristics`, `CodeQualityObservation`, `EdgeCaseObservation`, `PossibleIssue`, and
`SolutionAnalysis` itself. **Where used:** everywhere in the package; re-exported from
`src/index.ts` for external consumers.

### `packages/analysis/src/context.ts`

`CodeContext` (`code`, `lines`, `normalized` lowercased text, `language`) and
`buildCodeContext()`. Built once per `analyzeSolution()` call so no sub-analyzer re-splits or
re-lowercases the source independently. **Where used:** every sub-analyzer's public function
takes a `CodeContext` as its first argument.

### `packages/analysis/src/shared/codeStructure.ts`

The package's most load-bearing file. `stripStringsAndComments()` blanks out string/char/
template literals and `//`/`/* */`/`#` comments (preserving length and newlines) so brace and
keyword scanning never gets confused by a `{` or `for` that only appears inside a string or
comment. `analyzeLoopStructure()` picks brace-counting (C-like languages) or indentation-based
(Python) loop-nesting analysis by declared language, falling back to indentation analysis if
the brace method finds nothing (covers an unlabeled Python-shaped submission).
`extractFunctions()`/`detectRecursion()` find function/method definitions (brace-style and
Python `def`-style) and detect whether a function's own name appears as a call inside its own
body. **Where used:** `pattern-detector` (for DFS/recursion/backtracking/DP signals),
`complexity-analyzer` and `code-review` and `edge-case-analyzer` (all need loop structure and/or
recursion info), and `solution-analyzer.ts` (computes both once, passes them to everything
else). **What Phase 5+ may modify:** the functional-iteration gap (`.forEach`/`.map` not
counted as loops) and the nested-paren regex fragility noted above are the most likely places a
future phase would extend this file.

### `packages/analysis/src/pattern-detector/`

`types.ts` (the `Signal`/`PatternRule` interfaces and the `reportThreshold`/`confidenceCap`
model), `engine.ts` (`evaluatePatternRule` — turns a rule + a `CodeContext` into a `PatternMatch`
or `null`), `helpers.ts` (three small `Signal` constructors: regex-against-raw-code,
regex-against-lowercased-code, and arbitrary-predicate), `rules/*.ts` (six files, see the table
above), and `index.ts` (`detectPatterns()`, the module's one public function, plus the constant
list of every rule). **Where used:** `complexity-analyzer` and `edge-case-analyzer` both take
the already-computed `PatternMatch[]` as an input rather than re-detecting patterns themselves;
`solution-analyzer.ts` calls `detectPatterns()` once and threads the result through.

### `packages/analysis/src/complexity-analyzer/index.ts`

`estimateComplexity(ctx, patterns, loopStructure, recursion)` → `{ time, space }`. Also exports
`detectsExtraLinearStructure()`, reused by `solution-analyzer.ts` to populate
`AlgorithmCharacteristics.usesExtraLinearStructure` without duplicating that regex. **Where
used:** `solution-analyzer.ts` only (this module has no other consumer, unlike pattern-detector,
since complexity is the final synthesis step for that concern).

### `packages/analysis/src/code-review/index.ts`

`reviewCodeQuality(ctx, loopStructure)` → `CodeQualityObservation[]`. Seven independent check
functions, each returning zero or more observations, concatenated. **Where used:**
`solution-analyzer.ts`.

### `packages/analysis/src/edge-case-analyzer/index.ts`

`analyzeEdgeCases(ctx, patterns, loopStructure)` → `EdgeCaseObservation[]`. Five independent
check functions. **Where used:** `solution-analyzer.ts`.

### `packages/analysis/src/solution-analyzer.ts`

`analyzeSolution({ code, language })`, the package's single public entry point (also its default
export path via `src/index.ts`). Builds the context, runs every sub-analyzer exactly once,
derives `algorithmCharacteristics`, synthesizes `possibleIssues`, and derives the overall
`confidence`. **Where used:** this is what `src/index.ts` exports as the package's main API; it
has no consumer outside this package yet (see [What Phase 5 Will
Implement](#what-phase-5-will-implement)).

### `packages/analysis/src/fixtures/*.ts`

One file per required problem (see [Test Fixtures](#test-fixtures) below) plus `index.ts`
re-exporting all seven. Each fixture is `{ name, slug, language, code }` — plain data, not test
code, kept in `src/` (and shipped in `dist/`) rather than under a test-only path, since a later
phase (or a consumer of this package) may want representative example inputs without needing to
reach into this package's test suite.

## Test Fixtures

All 7 required problems, each run through the full `analyzeSolution()` pipeline in
`solution-analyzer.test.ts`, with assertions scoped to what's actually deterministic:

| Fixture | Language | Deterministically asserted |
| --- | --- | --- |
| **Two Sum** | JavaScript | Detects Hash Map; `O(n)` time; `O(n)` space |
| **Valid Parentheses** | JavaScript | Detects Stack; `O(n)` time; `O(n)` space |
| **Binary Search** | Python3 | Detects Binary Search; `O(log n)` time; `O(1)` space; no recursion |
| **Longest Substring Without Repeating Characters** | JavaScript | Detects Sliding Window and Hash Set; amortized `O(n)` time (the sliding-window override, not the naive `O(n^2)` a plain nesting count would give); loop nesting depth reported as 2 |
| **Maximum Subarray** | JavaScript | **An honest gap, documented in the fixture itself**: this is textbook Kadane's algorithm, but it neither sorts, mentions "dp"/"memo", nor allocates a table, so it triggers *no* pattern match at all, even though many people categorize Kadane's as DP or Greedy. `O(n)` time / `O(1)` space are still estimated correctly from loop structure alone. |
| **Merge Two Sorted Lists** | JavaScript | Detects Linked List Techniques (via the `ListNode` constructor call); `O(n)` time; `O(1)` space (correctly: this iterative merge reuses existing nodes, allocating nothing sized by the input) |
| **Number of Islands** | JavaScript | Detects DFS and Graph Traversal; **honestly reports `"Unknown (mixed loop + recursion)"` at low confidence** for time complexity — the true complexity is `O(rows * cols)` (each cell is visited a bounded number of times, amortized, because of the `visited` set), but this heuristic sees an outer nested loop *and* unrelated recursion with no matching specific pattern (not DP/backtracking/binary-search) and correctly declines to guess a specific polynomial degree. Documented in the fixture's own comment as a deliberate, accepted limitation rather than something special-cased away. |

Two fixtures (Maximum Subarray, Number of Islands) were chosen specifically to demonstrate the
engine's honesty about its own limits, per the task's explicit instruction not to pretend
pattern/complexity detection is perfect — both produce a stable, deterministic *output*, just
not the mathematically "ideal" one a human expert would give.

## Commands

```bash
npm install                                   # picks up the new @codereviewai/analysis workspace
npm run typecheck                             # all 5 workspaces (was 4 before this phase)
npm run test                                  # all 5 workspaces (164 tests total)
npm run test -w @codereviewai/analysis         # just this phase's package (73 tests)
npm run lint
npm run format
npm run build                                  # shared → analysis/api/web/extension
```

## Verification

Performed against this repository as part of completing Phase 4:

1. `npm install` — succeeds, 0 vulnerabilities.
2. `npm run typecheck` — passes in all 5 workspaces.
3. `npm run test` — 164/164 tests pass across all 5 workspaces (73 new in
   `@codereviewai/analysis`; the pre-existing 91 from Phases 1–3 unchanged and still passing).
4. `npm run lint` — 0 errors, 0 warnings (two `no-useless-escape` findings from an unnecessary
   `\-` inside regex character classes were caught and fixed during this phase).
5. `npm run format:check` — all files match Prettier style.
6. `npm run build` — all 5 packages build; confirmed no `*.test.*` files leak into
   `packages/analysis/dist`, and that the fixtures (intentionally non-test data) are present in
   the built output.
7. Re-verified Phases 1–3 were not broken: started the **production** API build
   (`node dist/index.js`) and confirmed `GET /api/health` still responds correctly.
8. Stopped all background dev/start processes after verification; confirmed no stray process
   left listening on port 4000.

Three real bugs were caught and fixed by this phase's own test suite before being considered
done (not left for a future phase to discover): the confidence-normalization flaw described in
[Pattern Detection](#pattern-detection), the nested-paren regex fragility in the Sliding Window
signal, and the null-guard direction bug in the edge-case analyzer's Linked List/Tree check. All
three are called out explicitly above rather than silently fixed, since understanding *why* the
current design looks the way it does matters for extending it correctly later.

## Limitations

- **No AST, no execution.** Every signal is regex/keyword/structural over the source text. It
  can be fooled by unconventional formatting, coincidental resemblance to a pattern, or code
  this heuristic simply doesn't recognize (see the Maximum Subarray fixture).
- **Functional iteration isn't counted as looping.** `.forEach(`, `.map(`, `.filter(`,
  `.reduce(` don't contribute to loop-nesting depth — only explicit `for`/`while`/`do-while`
  (and Python's indentation-based loops) do.
- **Regexes assuming one balanced paren pair can be fooled by nested calls** inside a loop
  condition (e.g. `while (seen.has(x))`). Fixed for the Sliding Window signal specifically
  (switched to a substring-search predicate); other signals sharing the same shape
  (`linearStructures.ts`, `traversal.ts`) were not individually stress-tested against every
  possible nested-call variation.
- **Complexity estimates are explicitly heuristic**, not proofs — `reasoning` always states
  what drove the estimate, and the Number of Islands fixture is a real example of the engine
  correctly declining to guess rather than confidently stating a wrong polynomial degree.
- **`possibleIssues` synthesis is opinionated**, not exhaustive — it's a capped, warning-only
  digest; the full findings are always still available in `codeQualityObservations`/
  `edgeCaseObservations`.
- **Not yet wired into the API or extension** — see below.

## What Phase 5 Will Implement

Per the roadmap in the README, Phase 5 introduces the AI integration layer. This is the natural
point where `@codereviewai/analysis` becomes a real dependency of `apps/api`: the AI prompt will
almost certainly be constructed *from* this phase's deterministic `SolutionAnalysis` (detected
patterns, complexity estimates, code-quality/edge-case observations) rather than the AI seeing
only raw code — grounding the AI's explanation in signals that were already objectively found,
and letting the AI focus on what a static heuristic genuinely cannot do (explaining *why* an
approach works, generating the optimal-approach comparison, writing prose). That phase will also
be the natural point to expose this engine's output through the API (e.g. as part of the
submission-creation response, or a dedicated analysis endpoint) and, if warranted, through the
extension's popup.
