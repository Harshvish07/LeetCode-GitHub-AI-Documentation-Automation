# Improvement Engine

Introduced in Phase 9. The improvement engine tracks how a learner's solutions **evolve** —
failed → improved → accepted/optimal — and turns the accumulated history into a learning profile
and recommendations.

The one rule behind every design decision: **everything it says is derived from stored data.**
There is no AI call in this phase, no free-text generation, and no statement without a rule that
produced it and a count of the rows it rests on. Where the data can't support a statement, the
engine says nothing (or says it has too little data) rather than guess.

- [Data model](#data-model)
- [Attempt history](#attempt-history)
- [Comparison logic](#comparison-logic)
- [Improvement outcome](#improvement-outcome)
- [Learning profile logic](#learning-profile-logic)
- [Recommendation logic](#recommendation-logic)
- [Document sections](#document-sections)
- [API](#api)
- [Limitations](#limitations)

## Data model

**No migration was added.** An "attempt" is a row that already existed: every
`POST /api/submissions` inserts a new `submissions` row (Phase 8 schema, `001_initial_schema`), and
a problem can have many of them (`problems` is unique on `slug`; `submissions.problem_id` is not).
The indexes `submissions_problem_received_idx (problem_id, received_at DESC)` and
`submissions_user_received_idx` already cover the new queries.

```text
problems 1 ─── * submissions ─── 0..1 analyses    (static analysis of that attempt)
                      │      └─── 0..1 reviews     (AI review of that attempt)
                      └────────── 0..1 documents
```

- **Attempt number** is not stored. It is the submission's position among that problem's
  submissions ordered by `received_at ASC, id ASC` (oldest = attempt 1), computed on read, so it can
  never drift out of sync with the rows. Consequence: a resubmission of unchanged code is an attempt.
- **Per-attempt analysis/review** exist only for attempts that were reviewed (`POST
  /api/submissions/:id/review`, `/document`, or `/publish` records them). Each submission keeps its
  latest analysis/review only (Phase 8 upserts on `submission_id`), so there is no *review* history —
  but there is *attempt* history, because each attempt is its own submission. An unreviewed attempt
  has `reviewed: false` and every review-derived field `null`/empty.

The engine's internal input is `AttemptRecord` (`analytics/attempts.ts`): a submission's columns
plus, when reviewed, patterns, time/space complexity (static and AI), quality score, optimality,
correctness-concern count and text, the AI's one-line approach, and the better approach's
description and time complexity. `PostgresLearningRepository.listAttemptRecords()` and
`getProblemAttempts(submissionId)` produce it with one `LEFT JOIN` query
(`ATTEMPT_SELECT`); the extraction of the few review fields from the stored `reviews.result` JSON
is in `toAttemptRecord`.

The wire types (`AttemptSummary`, `AttemptComparison`, `ProblemHistory`, `LearningProfile`,
`Recommendations`, …) live in `packages/shared/src/types/improvement.ts`.

## Attempt history

`buildProblemHistory(attempts)` (`analytics/comparison.ts`) returns, for one problem:

- `attempts[]` — per attempt: `attemptNumber`, `submittedAt`, `language`, `status`, `runtime`,
  `memory`, the exact `code`, `reviewed`, and (reviewed only) `timeComplexity`, `spaceComplexity`,
  `patterns`, `qualityScore`, `isOptimal`, concern/improvement counts, and the AI's `approach`.
- `comparisons[]` — each attempt compared with the one before it.
- `overview` — `attemptCount`, first/final status, `firstAcceptedAttempt`, `complexityJourney`, the
  [outcome](#improvement-outcome), and the plain-English `explanation`.

Complexity for an attempt is the AI's estimate when there is one, else the static analyzer's — the
same rule the dashboard uses.

## Comparison logic

`compareAttempts(from, to)` compares two attempts using only stored facts. Each finding, and how
it's decided:

| Finding | Rule |
| --- | --- |
| **Status change** | `fixed` if it moved to `Accepted`; `regressed` if it left `Accepted`; `unchanged` if equal; otherwise `changed` (e.g. Wrong Answer → Time Limit Exceeded). A `changed` move is reported as-is — the engine does not claim it means the logic got better. |
| **Complexity improvement** | Both notations are ranked by growth (`O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)`, in `packages/shared/src/dashboard/complexity.ts`) and compared: `improved`, `regressed`, `same`. A notation outside that list (`O(m·n)`, `Unknown`) is `unknown` — never guessed to be better or worse. Computed for time and for space. |
| **Pattern change** | The set of tracked patterns (static ∪ AI, normalized onto the 16 dashboard patterns) is diffed: `added` and `removed`. Untracked patterns such as "Brute Force" are not in the set. |
| **Algorithm change** | `true` when patterns were added or removed, or the time complexity class changed. `null` (not `false`) when either attempt is unreviewed — no review, no claim. |
| **Bug fixed** | `true` when the status moved to `Accepted`, **or** the review's correctness-concern count dropped. It is a signal from the judge or the reviewer, not a diff-level proof that a specific bug was patched. |
| **Code-quality improvement** | `true`/`false` from the sign of the quality-score delta (the Phase 8 heuristic score, [docs/database.md](database.md#quality-score)); `null` unless both attempts have a score. |
| **Code change** | A whitespace-insensitive line diff (`analytics/lineDiff.ts`): lines added, lines removed, identical, and whether the language changed. It uses a longest-common-subsequence, falling back to a line-frequency comparison above 1,500 lines. |

Every `highlights[]` sentence (e.g. "Time complexity improved from O(n^2) to O(n).") is generated from
one of these fields; none is free text. If either attempt lacks a review, a highlight says the
complexity/pattern/quality comparison is unavailable.

## Improvement outcome

`overview.outcome` is one of `single-attempt`, `improved`, `regressed`, `no-change`. Across the
whole history it counts improvements and regressions from three signals, comparing the **first**
and **last** attempt (or first/last *reviewed* attempt for review-based signals):

1. status — ended `Accepted` after not starting so (improvement) / the reverse (regression);
2. time complexity — improved / regressed;
3. quality score — rose / fell.

More improvements than regressions → `improved`; more regressions → `regressed`; otherwise
`no-change`. The `explanation` lists what was found, e.g.:

```text
Status path: Wrong Answer (attempt 1) → Time Limit Exceeded (attempt 2) → Accepted (attempt 3).
Reached Accepted on attempt 3 after 2 unsuccessful attempt(s).
Time complexity went O(n^2) → O(n).
Adopted: Hash Map.
Quality score rose from 50 to 95.
A bug fix is indicated in 2 step(s).
```

With fewer than two reviewed attempts it says so instead of describing complexity or patterns.

## Learning profile logic

`buildLearningProfile(attempts)` (`analytics/learningProfile.ts`) applies a fixed set of rules. A
weakness is called **recurring** only when at least `MIN_RECURRING = 2` occurrences support it;
each result carries `evidence: { count, total, examples[] }` — "N of M" plus up to three example
problems (linked in the UI). A rule with too little evidence produces nothing.

| Insight (`id`) | Kind | Evidence rule |
| --- | --- | --- |
| `repeated-time-limit-exceeded`, `repeated-wrong-answer` | weakness | ≥ 2 attempts with that judge status. |
| `unresolved-problems` | weakness | ≥ 2 problems with several attempts and none `Accepted`. |
| `slower-first-solutions` | weakness | ≥ 2 reviewed problems whose first reviewed attempt was asymptotically slower than a later attempt **or** than the review's own better approach. It names a pattern (e.g. Hash Map) when that pattern appears in the faster approach — "Frequently uses O(n²) solutions when a Hash Map can reduce lookup" is this rule firing. |
| `missed-edge-cases` | weakness | ≥ 2 reviewed problems whose AI *correctness concerns* mention an edge input (empty, null, single-element, duplicate, boundary, negative, zero, overflow…). |
| `accepted-not-optimal` | weakness | ≥ 2 reviewed `Accepted` solutions flagged non-optimal. |
| `recovers-from-failures` | strength | ≥ 2 problems that did not start `Accepted` and ended `Accepted`. |
| `weak-pattern-<name>` / `strong-pattern-<name>` | weakness / strength | From the per-pattern level below. "Strong in X but weak in Y" is a strong and a weak pattern insight. |

**Pattern level** (`buildPatternProfiles`, over each problem's *latest* attempt that has that
pattern): `untouched` (0 problems), `developing` (1 problem, or neither weak nor strong), `weak`
(≥ 2 problems and fewer than half `Accepted`, or at least half needing improvement), `strong`
(≥ 2 problems, all `Accepted`, none needing improvement, average quality ≥ 80 or unscored).
"Needing improvement" is the Phase 8 definition: reviewed and (not optimal or ≥ 1 correctness concern).

`notes[]` reports what the profile cannot say: no data yet, fewer than `MIN_PROBLEMS_FOR_PROFILE = 3`
problems, how many attempts have no review, and always that qualities like how well a solution is
explained are **not measured**. Consequently the example weakness "uses the correct algorithm but
explanations are weak" is deliberately **not produced** — nothing stored measures it.

## Recommendation logic

`buildRecommendations(attempts)` (`analytics/recommendations.ts`) builds two lists over the 16
tracked patterns:

- **Review** — a practiced pattern that is `weak`, ranked by lowest Accepted ratio; or a practiced,
  non-strong pattern that the AI's better approach suggested (and the user didn't use) on ≥ 2
  problems.
- **Practice more** — a pattern suggested by a better approach on ≥ 1 problem where the user has
  fewer than 2 problems in that pattern; and, once at least 3 problems exist, patterns never
  attempted at all (evidence `0 of N`).

Each entry has a `reason` and `evidence`. Lists are capped at 5. The `summary` mirrors the form
"Practice more: Sliding Window, Binary Search. Review: Hash Map, Two Pointers." With no data the
lists are empty and the summary says there is nothing to base recommendations on; with 1–2
problems only evidence-backed entries appear (no "never attempted" filler).

A pattern is "suggested" when the tracked-pattern keywords appear in the latest reviewed
attempt's `betterApproach.description` and aren't among that attempt's own patterns
(`findPatternsInText`, `analytics/patterns.ts`).

## Document sections

`generateDocument()` accepts optional `history` and `recurringMistakes`
(`document/types.ts`). When given, it renders — after Personal Review and before the footer:

- `## Submission History` — a table (attempt, date, status, language, runtime, memory, time, space,
  quality; `—` where an unreviewed attempt has no value) — and `## How My Solution Improved` —
  the overview explanation plus each step's highlights. Only for two or more attempts.
- `## Recurring Mistakes` — the weakness insights relevant to this submission (all non-pattern
  weaknesses, plus a pattern weakness only if this submission uses that pattern), each with "N of M".
  Only when there is at least one.

`ImprovementService.getDocumentContext(submissionId)` supplies them, limited to attempts **up to
and including** that submission (a document describes the moment it was written). The document and
publish controllers load it best-effort (`services/documentContext.ts`): with no database, or if the
lookup fails, the document is generated exactly as in Phase 6/7. All text passes through
`escapeMarkdown`/`tableCell`; the user's code is still never escaped.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/problems/:id/history` | `ProblemHistory` for the problem that submission `:id` belongs to (any attempt id works). |
| `GET /api/problems/:id/compare?from=1&to=3` | `AttemptComparison` between two attempt numbers. |
| `GET /api/learning/profile` | `LearningProfile`. |
| `GET /api/learning/recommendations` | `Recommendations`. |

Full request/response detail: [docs/api.md](api.md#improvement-endpoints). All need a database
(`503 DATABASE_NOT_CONFIGURED` otherwise) and none call the AI or GitHub.

## Limitations

- **Heuristics, not a model of the learner.** Thresholds (2 occurrences, 3 problems, "half"
  Accepted, quality ≥ 80) are judgment calls, documented here and in constants
  (`MIN_RECURRING`, `MIN_PROBLEMS_FOR_PROFILE`), and were not tuned against real learners.
- **Only what is stored.** Judge status, static analysis, and the AI review are all it knows.
  It cannot see how well a solution is explained, how long the learner spent, or why a bug happened.
- **Attempts are submissions.** Order of arrival defines attempt number; an unchanged resubmission
  counts; attempts submitted but never reviewed contribute status and code only.
- **Pattern suggestions are keyword matches** on the AI's better-approach text (a hint, not a
  proof: "sort" in a sentence yields `Sorting`), and pattern detection depends on the static
  analyzer's and the AI's own naming, normalized onto 16 patterns — untracked patterns are invisible.
- **A review can be wrong.** Complexity, optimality, correctness concerns, and quality score come
  from the AI review and the Phase 8 heuristic score; the engine inherits their errors. "Bug fixed"
  means the judge or the review says so, not that a fix was verified.
- **Edge-case detection is regex over the AI's concern text**; a concern worded without one of the
  keywords is missed.
- **One review per submission**, so there is no history of re-reviews of the same code.
- **Single user.** Everything belongs to the seeded local user; there is no per-user timezone.
- **No pagination or caching.** Profile and recommendations load every attempt and compute in
  application code — fine at personal scale.
- **Not verified in a real browser or against stock PostgreSQL**, like Phase 8: tested with PGlite
  and jsdom.
