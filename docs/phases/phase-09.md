# Phase 9 — Improvement Tracking

## Objective

Track a learner's evolution on each problem — failed solution → improved solution → accepted/optimal
solution — and turn the accumulated history into a personal learning profile and recommendations.
The constraint that shaped everything: **every statement must come from stored data, not be
invented.** Rules and their limits are in [../improvement-engine.md](../improvement-engine.md); this
page is the record of what was built, where, and how it was verified.

## Implementation Summary

| Requirement | Where it lives |
| --- | --- |
| Submission history (attempt number, timestamp, code, language, status, runtime, memory, complexity, AI review) | `AttemptRecord` → `buildProblemHistory` → `GET /api/problems/:id/history` → `AttemptTimeline` |
| Comparison (what changed, complexity, algorithm, pattern, bug fixed, code quality) | `compareAttempts` → `history.comparisons`, `GET /api/problems/:id/compare` → `ComparisonList` |
| "Explain how the user improved" | `overview.explanation` + `complexityJourney` → `ImprovementSummary` |
| Personal learning profile | `buildLearningProfile` → `GET /api/learning/profile` → `LearningProfilePanel` |
| Recommendation engine | `buildRecommendations` → `GET /api/learning/recommendations` → `RecommendationsPanel` |
| Document update (3 optional sections) | `document/templates/improvementSection.ts`, wired in `document-generator.ts` |
| Testing | 67 new API tests, 7 web, 5 shared (see [Testing](#testing)) |
| Documentation | this file, [improvement-engine.md](../improvement-engine.md), README, architecture, api, development, database notes |

**No migration.** Attempts are the `submissions` rows Phase 8 already stores, one per
`POST /api/submissions`; the attempt number is computed on read. No AI call is made anywhere in
this phase.

## Architecture

```text
GET /api/problems/:id/(history|compare)   GET /api/learning/(profile|recommendations)
        └── improvement.route → improvement.controller → ImprovementService
                                                         ├── LearningReader.getProblemAttempts / listAttemptRecords
                                                         └── analytics/ (pure): comparison · lineDiff · learningProfile · recommendations
POST …/document, …/publish ── loadDocumentContext (best-effort) ── ImprovementService.getDocumentContext
                                                                    └── generateDocument({ history, recurringMistakes })
```

Same shape as Phase 8: a thin service over a reader interface, with all logic in pure functions over
a plain record type, so it is unit-tested without a database and integration-tested on real Postgres
SQL via PGlite.

## Every Important File

### Shared — `packages/shared/src/`

| File | Purpose | Why | Where used | Depends on |
| --- | --- | --- | --- | --- |
| `types/improvement.ts` | Wire types: `AttemptSummary`, `AttemptComparison`, `ProblemHistory`, `ProblemHistoryOverview`, `LearningInsight`, `InsightEvidence`, `PatternProfile`, `LearningProfile`, `Recommendation(s)` | API and web share one definition | `apps/api` analytics/controllers, `apps/web` client and components | `types/dashboard.ts` (`TrackedPattern`), `types/leetcode.ts` |
| `dashboard/complexity.ts` (+ test) | `complexityGrowthRank`, `compareComplexity`: ranks Big-O notations by growth; `unknown` for unrecognized ones | The comparison's "complexity improved" needs a defensible ordering that never guesses | `analytics/comparison.ts`, `analytics/learningProfile.ts` | none |
| `index.ts` | Exports the above | | everything | |

### Analytics — `apps/api/src/analytics/` (all pure, no database)

| File | Purpose | Why | Where used | Depends on |
| --- | --- | --- | --- | --- |
| `attempts.ts` | `AttemptRecord` (one submission + optional review fields), `attemptPatterns/Time/Space`, `groupByProblem`, `ACCEPTED` | The single input type of every Phase 9 function | all files below, repository, fixtures | `patterns.ts` |
| `lineDiff.ts` (+ test, 5) | Whitespace-insensitive added/removed line counts via LCS, with a frequency fallback above 1,500 lines | "What changed" in the code, without storing diffs | `comparison.ts` | none |
| `comparison.ts` (+ test, 11) | `compareAttempts` (status, complexity, patterns, algorithm change, bug fixed, quality, code diff, highlights), `buildProblemHistory` (attempts, comparisons, overview, outcome, explanation), `toAttemptSummary` | The core of "how the user improved" | `ImprovementService` | `attempts.ts`, `lineDiff.ts`, shared `compareComplexity` |
| `learningProfile.ts` (+ test, 21 with recommendations) | `buildLearningProfile`, `buildPatternProfiles`, `suggestedPatternsFor`, `collectSuggestedPatterns`, thresholds `MIN_RECURRING`, `MIN_PROBLEMS_FOR_PROFILE` | Recurring weaknesses/strengths from stored data with evidence | `ImprovementService`, `recommendations.ts` | `attempts.ts`, `patterns.ts`, `qualityScore.ts` |
| `recommendations.ts` | `buildRecommendations`: Review / Practice-more lists over the 16 tracked patterns | "Based on actual history" | `ImprovementService` | `learningProfile.ts`, `attempts.ts` |
| `patterns.ts` (modified) | Added `findPatternsInText` — every tracked pattern named in a sentence | Detects which pattern the AI's better approach suggests | `learningProfile.ts` | shared `TRACKED_PATTERNS` |

### Persistence — `apps/api/src/persistence/` (modified)

| File | Change | Why |
| --- | --- | --- |
| `learningRepository.ts` | `LearningReader` gained `listAttemptRecords()` and `getProblemAttempts(submissionId)` | Attempt-level reads, separate from the latest-per-problem dashboard read |
| `postgresLearningRepository.ts` | `ATTEMPT_SELECT` (submissions ⟕ analyses ⟕ reviews), `toAttemptRecord`, the two new methods (scoped to the user; non-UUID id → `null`; ordered `received_at, id`) | Produces `AttemptRecord`s; pulls the few needed fields (approach, correctness-concern text, better approach) out of the stored review JSON |
| `unavailableLearningReader.ts` | The two new methods reject `503 DATABASE_NOT_CONFIGURED` | Same "fail clearly without a database" behavior as Phase 8 |

### API layer — `apps/api/src/`

| File | Purpose | Why | Depends on |
| --- | --- | --- | --- |
| `services/improvement.service.ts` | `ImprovementService`: `getProblemHistory`, `compare`, `getProfile`, `getRecommendations`, `getDocumentContext` (attempts up to and including the submission + relevant weaknesses); `AttemptNotFoundError` | Fetch-and-delegate only, like `DashboardService` | `LearningReader`, `analytics/*` |
| `services/documentContext.ts` | `loadDocumentContext`: best-effort wrapper returning `{}` when there is no database or the lookup fails (logs only the message) | A history problem must never cost the caller a document or a paid review | `ImprovementService` |
| `controllers/improvement.controller.ts` | Four thin handlers; maps `AttemptNotFoundError` → 404 | HTTP concerns only | service, `schemas/compareQuery.schema.ts` |
| `routes/improvement.route.ts` | Mounts the four `GET`s | | controller |
| `schemas/compareQuery.schema.ts` (+ test, 8) | Zod validation of `from`/`to` (positive integers, first value of a repeated param) | Input is untrusted | zod |
| `routes/index.ts` (modified) | Builds one `ImprovementService`, mounts the router, gives it to the document/publish controllers only when a database exists | Composition root | |
| `controllers/documents.controller.ts`, `publish.controller.ts` (modified) | Accept optional `improvement`; load context after the review is recorded (so the history includes it) and pass it to `generateDocument` | Document update | `documentContext.ts` |

### Documents — `apps/api/src/document/`

| File | Purpose | Why |
| --- | --- | --- |
| `types.ts` (modified) | `DocumentGenerationInput` gained optional `history` and `recurringMistakes` | Backwards compatible: omitted = Phase 6 output |
| `templates/improvementSection.ts` | `renderHistorySections` (`## Submission History` table + `## How My Solution Improved`) and `renderRecurringMistakes` | Each section group has its own template file (Phase 6 convention); all text through `escapeMarkdown`/`tableCell` |
| `document-generator.ts` (modified) | Renders the sections between Personal Review and the footer only when history has ≥ 2 attempts / mistakes non-empty | "Optionally include" |

### Web — `apps/web/src/`

| File | Purpose |
| --- | --- |
| `api/improvementApi.ts` | Typed client for the four endpoints (reuses the exported `get` from `dashboardApi.ts`) |
| `components/improvement/AttemptTimeline.tsx` | Every attempt: status, date, quality, language, runtime, memory, complexity, AI approach, collapsible code (rendered through `CodeBlock`, i.e. as text) |
| `components/improvement/ImprovementSummary.tsx` | Outcome badge, complexity journey, explanation |
| `components/improvement/ComparisonList.tsx` | One card per consecutive pair, with "Bug fixed" / "Approach changed" badges |
| `components/improvement/ProblemHistorySection.tsx` | Loads the history independently so a failure never hides the rest of the detail page |
| `components/improvement/LearningProfilePanel.tsx` | Weaknesses and strengths with "N of M" evidence and example links, pattern-level table, profile notes |
| `components/improvement/RecommendationsPanel.tsx` | Summary plus Practice-more / Review lists |
| `pages/LearningPage.tsx` | Composes the two panels; each loads and fails independently |
| `pages/ProblemDetailPage.tsx`, `router/routes.ts`, `components/layout/AppHeader.tsx`, `App.tsx`, `index.css` (modified) | History section on the detail page; `#/learning` route and header link; styles |
| `testing/fixtures.ts` (modified) | `attemptSummary`, `problemHistory`, `learningProfile`, `recommendations` builders |

### Test-only

`apps/api/src/testing/attemptFixtures.ts` (`attemptRecord` builder; excluded from the build with the rest
of `src/testing/`).

## API

Four read-only endpoints, documented with examples in [../api.md](../api.md#improvement-endpoints):
`GET /api/problems/:id/history`, `GET /api/problems/:id/compare?from=&to=`,
`GET /api/learning/profile`, `GET /api/learning/recommendations`. The document and publish endpoints
gain optional sections in the generated Markdown; their response shape is unchanged.

## Testing

New tests: **67 API, 7 web, 5 shared = 79** (total 730: API 476, extension 41, web 102, shared 38, analysis 73).

| Area | File | Covers |
| --- | --- | --- |
| Multiple submissions | `routes/improvement.route.test.ts` (14, real PGlite) | Three attempts (Wrong Answer → Time Limit Exceeded → Accepted) returned in order from any attempt id; unreviewed attempts kept; problems separated; 404 for unknown/malformed ids |
| Comparison | `analytics/comparison.test.ts` (11), route test | Fixed/regressed/changed status, complexity improved/regressed/unknown, patterns added, algorithm change, bug fixed (status and dropped concern), no claims without a review, identical code, language change |
| Improvement detection | `comparison.test.ts`, `complexity.test.ts` (5), `lineDiff.test.ts` (5) | Outcome `improved`/`regressed`/`no-change`/`single-attempt`, complexity journey, growth ranking, line diff |
| Recommendations | `learningProfile.test.ts` (21, includes recommendations) | Review a weak pattern with evidence; practice a suggested-but-unused pattern; review one suggested on ≥ 2 problems; never-attempted patterns only with ≥ 3 problems; cap of 5 |
| Learning profile | `learningProfile.test.ts`, route test | Each rule fires only at its threshold, with counts and examples; strengths; pattern levels; notes |
| No-data cases | `learningProfile.test.ts`, route test, web tests | Empty history, single attempt, tiny history, no database (`503` on all four endpoints), unreviewed attempts |
| Document update | `document-generator.test.ts` (+6), route test (5 document scenarios) | Sections omitted by default and for one attempt; table with `—` for missing values; escaping; code untouched; history stops at the documented submission; no-database output unchanged |
| Validation | `schemas/compareQuery.schema.test.ts` (8) | `from`/`to` rules |
| Web | `pages/improvementPages.test.tsx` (7), updated `pages.test.tsx`/`App.test.tsx` | History section, code shown as text, unreviewed marker, independent failure, Learning page (data, empty, error/retry) |

No test calls a real AI or GitHub API; database tests run real SQL on PGlite.

## Commands

```bash
npm run typecheck && npm run lint && npm run format:check
npm run test
npm run build
```

## Verification

All run at the end of this phase:

- `npm run typecheck` — 0 errors in every workspace.
- `npm run test` — 730 tests pass (API 476, extension 41, web 102, shared 38, analysis 73).
- `npm run lint` and `npm run format:check` — clean.
- `npm run build` — clean; no test, mock, PGlite, or `testing/` file appears in `apps/api/dist`.

**Not verified** (as in Phase 8): the history section and Learning page were never rendered in a real
browser (jsdom only); nothing was run against a stock PostgreSQL server (PGlite runs the SQL);
the profile thresholds were not tuned on real learner data.

## Design decisions worth knowing

- **No schema change.** Adding a `attempt_number` column or a stored comparison would create data that
  can drift from the submissions; computing on read cannot.
- **`null`, not `false`, when there's no data.** `algorithmChanged`, `codeQualityImproved`, and
  complexity `unknown` mean "can't say"; the UI and document show `—`.
- **A weakness needs two occurrences** and reports `N of M`, so no single bad attempt becomes a
  "recurring" claim, and every claim can be traced.
- **The "explanations are weak" example is deliberately not implemented** — nothing stored measures
  explanation quality, and inventing it would violate the phase's one rule. The profile says so.
- **Documents describe their moment.** History includes attempts only up to the documented submission.
- **History is an extra, never a dependency.** The document/publish endpoints load it best-effort.

## Limitations

See [../improvement-engine.md#limitations](../improvement-engine.md#limitations). In short:
heuristic thresholds, attempts = submissions in arrival order, keyword-based pattern suggestions and
edge-case detection, inherited AI-review errors, one review per submission, single local user, no
pagination, and no browser/stock-Postgres verification.

## What Phase 10 Could Implement

Per the roadmap, polish, deployment, and end-to-end hardening — not started.
