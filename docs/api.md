# API Reference

Base URL (development): `http://localhost:4000`

Every response — success or failure — is a JSON object shaped like:

```ts
// success
{ "success": true, "data": T }

// failure
{ "success": false, "error": { "message": string, "code"?: string, "details"?: unknown } }
```

This is the `ApiResponse<T>` type from `@codereviewai/shared`. `error.details` is present only
on errors that carry extra machine-readable detail (currently: validation errors, as an array
of `{ path, message }` issues).

---

## `GET /api/health`

**Purpose:** liveness/health check — confirms the API process is up and returns basic runtime
info. Introduced in Phase 1.

### Request

No parameters, no body.

### Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 42.7,
    "timestamp": "2026-09-15T14:10:15.255Z",
    "version": "0.2.0"
  }
}
```

### Errors

None — this endpoint cannot fail short of the process being down entirely.

---

## `POST /api/submissions`

**Purpose:** receives a captured LeetCode problem + submission from the Chrome extension,
validates it, normalizes it, assigns it a server-side id, and stores it — in PostgreSQL when
`DATABASE_URL` is set (Phase 8, see [docs/database.md](database.md)), otherwise in memory and lost on
restart (see [docs/phases/phase-03.md](phases/phase-03.md#limitations)). Introduced in Phase 3.

### Request

`Content-Type: application/json`

```ts
interface CreateSubmissionRequest {
  problem: {
    url: string; // must be a leetcode.com/problems/<slug>/... URL
    slug: string; // lowercase letters, digits, hyphens only
    number: number | null; // positive integer, or null if not detected
    title: string; // required, 1-300 characters
    difficulty: 'Easy' | 'Medium' | 'Hard' | null;
    description: string | null;
  };
  submission: {
    language: LeetCodeLanguage | null; // must be one of a known-language whitelist, or null
    code: string; // required — a "submission" with no code is rejected
    status: LeetCodeSubmissionStatus | null; // one of a known-status whitelist, or null
    runtime: string | null;
    memory: string | null;
  };
  metadata: {
    extractedAt: string; // ISO 8601 datetime
    source: 'extension'; // the only accepted value today
  };
}
```

`LeetCodeLanguage` and `LeetCodeSubmissionStatus` are the exact whitelists defined in
`@codereviewai/shared` (`LEETCODE_LANGUAGES`, `LEETCODE_SUBMISSION_STATUSES`) — the same lists
the extension's extractor matches against, so a value the extension can legitimately produce is
always accepted.

**Every nullable field really is optional-in-spirit** — Phase 2's extractor returns `null` for
anything it can't find reliably, and the API accepts that honestly rather than requiring a
client to invent a value. `problem.slug`, `problem.title`, and `submission.code` are the
exceptions: they're required because a submission missing any of them isn't meaningfully a
submission.

#### Example request body

```json
{
  "problem": {
    "url": "https://leetcode.com/problems/two-sum/",
    "slug": "two-sum",
    "number": 1,
    "title": "Two Sum",
    "difficulty": "Easy",
    "description": "Given an array of integers, return indices of the two numbers that add up to a target."
  },
  "submission": {
    "language": "JavaScript",
    "code": "var twoSum = function(nums, target) {\n  return [];\n};",
    "status": "Accepted",
    "runtime": "52 ms",
    "memory": "42.1 MB"
  },
  "metadata": {
    "extractedAt": "2026-09-15T14:10:15.000Z",
    "source": "extension"
  }
}
```

### Response — `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "b33ae260-50f6-41ca-9062-cf75b13132fb",
    "problem": {
      "url": "https://leetcode.com/problems/two-sum/",
      "slug": "two-sum",
      "number": 1,
      "title": "Two Sum",
      "difficulty": "Easy",
      "description": "Given an array of integers, return indices of the two numbers that add up to a target."
    },
    "submission": {
      "language": "JavaScript",
      "code": "var twoSum = function(nums, target) {\n  return [];\n};",
      "status": "Accepted",
      "runtime": "52 ms",
      "memory": "42.1 MB"
    },
    "metadata": {
      "extractedAt": "2026-09-15T14:10:15.000Z",
      "source": "extension",
      "receivedAt": "2026-09-15T14:10:15.348Z"
    }
  }
}
```

`id` is server-assigned (`crypto.randomUUID()`). `metadata.receivedAt` is the server's own
timestamp of when the request was processed — distinct from the client-claimed
`metadata.extractedAt`, since the server doesn't fully trust a client-supplied timestamp either.
`problem.slug` is lowercased and `problem.title`/`problem.description` are trimmed as part of
normalization; `submission.code` is stored exactly as sent, with no trimming or reformatting.

### Errors

| Status | `error.code` | When |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | The body doesn't satisfy the schema above — see `error.details`. |
| `400` | `MALFORMED_JSON` | The request body isn't valid JSON at all. |
| `404` | `NOT_FOUND` | Wrong path/method (applies to any route, not just this one). |
| `500` | `INTERNAL_ERROR` | An unexpected server-side failure. |

#### Example — `400 VALIDATION_ERROR`

Request with `submission.code` omitted:

```json
{
  "success": false,
  "error": {
    "message": "Request validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "path": "submission.code", "message": "submission.code is required" }
    ]
  }
}
```

`error.details` is always an array of `{ path, message }` — `path` is a dot-separated field
path (e.g. `"submission.code"`, `"problem.url"`), so a client can map a validation failure back
to the exact field that caused it. Multiple issues can be present in a single response (e.g. a
payload missing `problem`, `submission`, and `metadata` entirely reports all three).

#### Example — `400 MALFORMED_JSON`

Request body is not valid JSON syntax (e.g. `{ not valid json`):

```json
{
  "success": false,
  "error": { "message": "Malformed JSON in request body", "code": "MALFORMED_JSON" }
}
```

#### Example — `404 NOT_FOUND`

```json
{
  "success": false,
  "error": { "message": "Route not found: GET /api/does-not-exist", "code": "NOT_FOUND" }
}
```

---

## `POST /api/submissions/:id/review`

**Purpose:** generates an AI-powered review of a previously stored submission, combining it
with a freshly recomputed deterministic (non-AI) analysis and an explicit comparison between
the two. Introduced in Phase 5. See [docs/ai-analysis.md](ai-analysis.md) for the full
architecture, prompt design, validation, and privacy/cost details.

### Request

No request body — `:id` is the id returned by `POST /api/submissions`.

```
POST /api/submissions/b33ae260-50f6-41ca-9062-cf75b13132fb/review
```

### Response — `200 OK`

```ts
interface CombinedSolutionReview {
  submissionId: string;
  deterministic: SolutionAnalysis;    // Phase 4's engine — see packages/analysis
  ai: SolutionReview;                  // schema-validated AI output, 15 fields answering the 16 required questions
  agreement: {
    time: { matches: boolean; deterministic: string; ai: string };
    space: { matches: boolean; deterministic: string; ai: string };
    patternsAgreedOn: string[];
    patternsOnlyInDeterministic: string[];
    patternsOnlyInAi: string[];
    hasDisagreement: boolean;
  };
  generatedAt: string; // ISO 8601, server-assigned
}
```

`deterministic` and `ai` are always both present, in full, side by side — never merged into a
single "best guess." `agreement` is always present too, even when both analyses fully agree
(`hasDisagreement: false`); see
[docs/ai-analysis.md#deterministic-vs-ai-analysis](ai-analysis.md#deterministic-vs-ai-analysis)
for why disagreement is surfaced rather than hidden, and
[docs/phases/phase-05.md#example-inputoutput](phases/phase-05.md#example-inputoutput) for a
full worked example of both a matching and a disagreeing response.

### Errors

| Status | `error.code` | When |
| --- | --- | --- |
| `404` | `NOT_FOUND` | No submission exists with the given `:id`. |
| `429` | `AI_RATE_LIMITED` | The AI provider rate-limited the request. |
| `500` | `INTERNAL_ERROR` | An unexpected server-side failure (including the near-impossible case of a stored submission somehow missing its code). |
| `502` | `AI_PROVIDER_ERROR` | The AI provider returned an error, a network failure occurred, or (in local dev) `AI_PROVIDER_API_KEY` isn't configured at all. |
| `502` | `AI_MALFORMED_RESPONSE` | The AI's raw response wasn't valid JSON (after stripping a markdown fence, if present). |
| `502` | `AI_INVALID_RESPONSE` | The AI's JSON response didn't match the required schema — a missing field, wrong type, or invalid enum value. See `error.details`. |
| `504` | `AI_TIMEOUT` | The AI provider didn't respond within the configured timeout (30s by default). |

#### Example — `404 NOT_FOUND`

```json
{
  "success": false,
  "error": { "message": "No submission found with id \"does-not-exist\".", "code": "NOT_FOUND" }
}
```

#### Example — `502 AI_PROVIDER_ERROR` (no API key configured)

```json
{
  "success": false,
  "error": {
    "message": "AI provider is not configured: AI_PROVIDER_API_KEY is not set.",
    "code": "AI_PROVIDER_ERROR"
  }
}
```

This is the actual response `POST /api/submissions/:id/review` returns in a local dev
environment with no `AI_PROVIDER_API_KEY` set — every other endpoint (including creating
submissions) works completely normally regardless; only this one endpoint requires the key,
and it fails clearly rather than crashing the process when it's missing.

---

## `POST /api/submissions/:id/document`

**Purpose:** generates a complete Markdown learning document for a previously stored
submission — the problem, the exact submitted code, Phase 4's deterministic analysis, Phase 5's
AI review, and their agreement, combined into one human-readable `.md` file. Introduced in
Phase 6. See [docs/document-generation.md](document-generation.md) for the full document
schema, escaping rules, and filename strategy.

Internally this runs the exact same deterministic-analysis-plus-AI-review pipeline as
`POST /api/submissions/:id/review` (both call the same `buildCombinedReview()` helper) — it is
**not** cheaper and **not** cached; each call makes a fresh AI provider request. It does not
save the document anywhere; the response *is* the document.

### Request

No request body — `:id` is the id returned by `POST /api/submissions`.

```
POST /api/submissions/b33ae260-50f6-41ca-9062-cf75b13132fb/document
```

### Response — `200 OK`

```ts
interface GeneratedDocument {
  filename: string; // a safe filename, e.g. "001-two-sum.md"
  content: string; // the complete Markdown document
}
```

See [docs/document-generation.md#example-document](document-generation.md#example-document) for
a full real example (generated live against the Gemini provider).

### Errors

Identical error set to `POST /api/submissions/:id/review` (same underlying pipeline) — see that
endpoint's error table above. `error.code` values: `NOT_FOUND`, `AI_RATE_LIMITED`,
`INTERNAL_ERROR`, `AI_PROVIDER_ERROR`, `AI_MALFORMED_RESPONSE`, `AI_INVALID_RESPONSE`,
`AI_TIMEOUT`.

---

## `POST /api/submissions/:id/publish`

**Purpose:** generates the same document `POST /api/submissions/:id/document` does, then commits
it to a configured GitHub repository — `problems/NNN-slug/README.md`, an updated
`problems/index.json`, and a re-rendered root `README.md` table. Introduced in Phase 7. See
[docs/github-integration.md](github-integration.md) for the full design, repository layout,
commit process, and duplicate-handling contract.

Runs the exact same `buildCombinedReview()` + `generateDocument()` pipeline as `/document`, so it
costs the same (one fresh AI call, no caching) plus up to three GitHub API writes.

### Request

```ts
interface PublishRequestBody {
  /** Optional — defaults to "create". */
  mode?: 'create' | 'update';
}
```

```
POST /api/submissions/b33ae260-50f6-41ca-9062-cf75b13132fb/publish
Content-Type: application/json

{ "mode": "create" }
```

`mode` is the explicit, typed way to state intent: `"create"` (the default) publishes a new
problem and is **rejected** if one already exists at that path; `"update"` intentionally
overwrites an existing one and is **rejected** if nothing exists yet. See
[docs/github-integration.md#duplicate-handling](github-integration.md#duplicate-handling).

### Response — `200 OK`

```ts
interface PublishResult {
  status: 'created' | 'updated' | 'unchanged';
  path: string; // e.g. "problems/001-two-sum/README.md"
  documentUrl: string; // browsable link, e.g. https://github.com/owner/repo/blob/main/problems/001-two-sum/README.md
  commitUrl?: string; // omitted when status is "unchanged" (no commit was made)
  index: { updated: boolean };
  readme: { updated: boolean };
}
```

`status: "unchanged"` means the document's content was byte-identical to what's already
published — no commit was made anywhere, including to the index or README.

### Errors

| Status | `error.code` | When |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `mode` is present but isn't `"create"` or `"update"`. |
| `404` | `NOT_FOUND` | No submission exists with the given `:id`. |
| `404` | `GITHUB_NOT_FOUND` | The repository doesn't exist/isn't visible to the token, or `mode="update"` was used but nothing has been published for this problem yet. |
| `409` | `GITHUB_CONFLICT` | `mode="create"` (or omitted) against a problem that's already published — the "avoid accidental overwrite" case. Nothing is written. |
| `429` | `GITHUB_RATE_LIMITED` | GitHub returned HTTP 403 (rate limited or insufficient token permissions). |
| `429` | `AI_RATE_LIMITED` | The AI provider rate-limited the request. |
| `500` | `INTERNAL_ERROR` | An unexpected server-side failure. |
| `502` | `GITHUB_AUTH_FAILED` | `GITHUB_TOKEN`/`GITHUB_REPO` missing or invalid. |
| `502` | `GITHUB_API_ERROR` | An unexpected GitHub API failure. |
| `502` | `AI_PROVIDER_ERROR` / `AI_MALFORMED_RESPONSE` | Same AI-pipeline failures as `/review` and `/document`. |
| `502` | `AI_INVALID_RESPONSE` | The AI's JSON response didn't match the required schema. |
| `504` | `AI_TIMEOUT` | The AI provider didn't respond within the configured timeout. |

#### Example — `409 GITHUB_CONFLICT`

```json
{
  "success": false,
  "error": {
    "message": "A document for this problem already exists at \"problems/001-two-sum/README.md\". Re-submit with mode=\"update\" to intentionally overwrite it.",
    "code": "GITHUB_CONFLICT"
  }
}
```

#### Example — `502 GITHUB_AUTH_FAILED` (no token configured)

```json
{
  "success": false,
  "error": {
    "message": "GitHub is not configured: GITHUB_REPO must be set as \"owner/repo\" (got unset).",
    "code": "GITHUB_AUTH_FAILED"
  }
}
```

This is the actual response `POST /api/submissions/:id/publish` returns in a local dev
environment with no `GITHUB_REPO`/`GITHUB_TOKEN` set — every other endpoint (including
`/review` and `/document`) works completely normally regardless; only this one endpoint requires
GitHub configuration, and it fails clearly rather than crashing the process when it's missing.

---

## Dashboard endpoints

Introduced in Phase 8. All four are read-only `GET`s that serve the web dashboard. They read from
PostgreSQL, so they need `DATABASE_URL` configured — see [docs/database.md](database.md). Without
it, every one answers:

```json
{
  "success": false,
  "error": {
    "message": "The dashboard needs a database: set DATABASE_URL and restart the API. See docs/database.md.",
    "code": "DATABASE_NOT_CONFIGURED"
  }
}
```

(HTTP `503`.) They never call the AI or GitHub — they only read what earlier `/review`, `/document`,
and `/publish` calls recorded, so they are cheap and safe to call as often as you like. A
submission only shows up with a review, quality score, patterns, or GitHub link **after** the
matching endpoint has been called for it.

The wire types (`DashboardSummary`, `PatternStat`, `ProblemListItem`, `ProblemDetail`,
`ProblemListQuery`) live in `@codereviewai/shared`, so the web app and the API share one
definition. The rules behind each number are in
[docs/database.md#analytics-rules](database.md#analytics-rules).

### `GET /api/dashboard/summary`

The dashboard's headline numbers.

```ts
interface DashboardSummary {
  totalProblems: number; // distinct problems, each counted once by its latest submission
  acceptedSolutions: number; // latest submission is "Accepted"
  needingImprovement: number; // reviewed, and not optimal or has correctness concerns
  optimalSolutions: number; // reviewed and judged optimal
  unreviewed: number; // no AI review yet
  currentStreak: number; // consecutive UTC days with a submission, ending today/yesterday
  longestStreak: number;
  patternsPracticed: number; // distinct tracked patterns across Accepted solutions
  difficultyDistribution: { Easy: number; Medium: number; Hard: number; Unknown: number };
  recentProblems: ProblemListItem[]; // the five most recent
}
```

**Errors:** `503 DATABASE_NOT_CONFIGURED`.

### `GET /api/dashboard/patterns`

One entry for each of the 16 tracked patterns — always all 16, in a fixed order, including ones
with no solutions yet (so gaps in practice are visible).

```ts
interface PatternStat {
  pattern: 'Hash Map' | 'Two Pointers' | 'Sliding Window' | 'Binary Search' | 'Stack' | 'Queue'
         | 'BFS' | 'DFS' | 'Heap' | 'Greedy' | 'Backtracking' | 'Dynamic Programming'
         | 'Graph' | 'Tree' | 'Prefix Sum' | 'Sorting';
  solved: number; // Accepted solutions using the pattern
  averageQuality: number | null; // mean quality (0-100) of the reviewed ones, or null
  improvementOpportunities: number; // solved ones that need improvement
  revisit: Array<{ submissionId: string; title: string }>; // up to 3, lowest quality first
}
```

**Errors:** `503 DATABASE_NOT_CONFIGURED`.

### `GET /api/problems`

The problem list — one row per problem (its latest submission), with optional search, filtering,
and sorting. Every parameter is optional; an empty value (`?difficulty=`) is treated as absent.

| Query parameter | Values | Effect |
| --- | --- | --- |
| `search` | text, ≤ 200 chars | Case-insensitive match against title, slug, problem number, and pattern names. |
| `difficulty` | `Easy` \| `Medium` \| `Hard` | Exact match. |
| `pattern` | one of the 16 tracked patterns | The problem uses that pattern. |
| `status` | text (e.g. `Accepted`, `Wrong Answer`) | Exact match. |
| `language` | text (e.g. `Python`) | Exact match. |
| `sortBy` | `number` \| `title` \| `difficulty` \| `language` \| `status` \| `complexity` \| `quality` \| `date` | Default `date`. `difficulty` orders Easy < Medium < Hard; `complexity` orders by growth rate (O(1) < O(log n) < O(n) < …). Rows with no value for the sort key always sort last, in either direction. |
| `sortOrder` | `asc` \| `desc` | Default `desc` for `date`, `asc` otherwise. |

Filters combine with AND. Search/filter/sort are implemented once, in `@codereviewai/shared`
(`applyProblemQuery`), and applied server-side.

```ts
interface ProblemListItem {
  submissionId: string; // the id used by GET /api/problems/:id
  problemId: string;
  number: number | null;
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | null;
  patterns: TrackedPattern[]; // static + AI patterns, normalized; [] until reviewed
  language: string | null;
  status: string | null;
  timeComplexity: string | null; // AI's assessment, or the static estimate if unreviewed
  qualityScore: number | null; // 0-100; null until reviewed
  isOptimal: boolean | null;
  reviewed: boolean;
  submittedAt: string; // ISO 8601
  githubUrl: string | null; // link to the published document, once published
}
```

Response: `ProblemListItem[]`.

**Example:** `GET /api/problems?difficulty=Medium&pattern=Two%20Pointers&sortBy=quality&sortOrder=asc`

**Errors:**

| Status | `error.code` | When |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | A parameter has an invalid value (unknown difficulty/pattern/sort key, or `search` over 200 chars) — see `error.details`. |
| `503` | `DATABASE_NOT_CONFIGURED` | No database. |

### `GET /api/problems/:id`

The full detail for one problem. `:id` is a **submission id** (the `submissionId` from the list —
the same id `POST /api/submissions` returned).

```ts
interface ProblemDetail {
  submissionId: string;
  problem: { number, slug, title, difficulty, url, description };
  submission: { language, code, status, runtime, memory, submittedAt }; // the exact submitted code
  analysis: AnalysisDetail | null; // Phase 4 static analysis; null until reviewed
  review: ReviewDetail | null; // Phase 5 AI review, incl. betterApproach + agreement; null until reviewed
  qualityScore: number | null;
  document: { filename: string; githubUrl: string | null; publishedAt: string | null } | null;
}
```

`review.betterApproach` is `null` when the solution is already optimal; otherwise it carries the
description, pseudocode, code, complexity, and why it's better — always separate from
`submission.code`, which is never modified. `review.agreement.hasDisagreement` is `true` when static
analysis and the AI disagreed.

**Errors:**

| Status | `error.code` | When |
| --- | --- | --- |
| `404` | `NOT_FOUND` | No submission with that id — including an id that isn't a valid UUID. |
| `503` | `DATABASE_NOT_CONFIGURED` | No database. |

---

## Improvement endpoints

Introduced in Phase 9. Four read-only `GET`s that track how solutions evolve across attempts. Like
the [dashboard endpoints](#dashboard-endpoints) they read PostgreSQL only, so without `DATABASE_URL`
each answers `503 DATABASE_NOT_CONFIGURED`; they never call the AI or GitHub. Everything returned is
derived from stored rows — see [docs/improvement-engine.md](improvement-engine.md) for the rules.
An "attempt" is one submission of a problem; attempt numbers are 1-based, in order of arrival. Wire
types (`ProblemHistory`, `AttemptComparison`, `LearningProfile`, `Recommendations`) are in
`@codereviewai/shared`.

### `GET /api/problems/:id/history`

`:id` is the id of **any** submission of the problem (as with `GET /api/problems/:id`); the response
covers every attempt at that problem.

```json
{
  "success": true,
  "data": {
    "problem": { "number": 1, "slug": "two-sum", "title": "Two Sum", "difficulty": "Easy" },
    "attempts": [
      {
        "attemptNumber": 1,
        "submissionId": "9c1f…",
        "submittedAt": "2026-09-17T10:00:00.000Z",
        "language": "JavaScript",
        "status": "Wrong Answer",
        "runtime": "52 ms",
        "memory": "42.1 MB",
        "code": "…exactly as submitted…",
        "reviewed": true,
        "timeComplexity": "O(n^2)",
        "spaceComplexity": "O(1)",
        "patterns": [],
        "qualityScore": 50,
        "isOptimal": false,
        "correctnessConcernsCount": 1,
        "improvementsCount": 1,
        "approach": "Check every pair."
      }
    ],
    "comparisons": [
      {
        "fromAttempt": 1,
        "toAttempt": 2,
        "status": { "from": "Wrong Answer", "to": "Accepted", "change": "fixed" },
        "timeComplexity": { "from": "O(n^2)", "to": "O(n)", "change": "improved" },
        "spaceComplexity": { "from": "O(1)", "to": "O(1)", "change": "same" },
        "patterns": { "added": ["Hash Map"], "removed": [] },
        "algorithmChanged": true,
        "qualityScore": { "from": 50, "to": 95, "delta": 45 },
        "correctnessConcerns": { "from": 1, "to": 0, "delta": -1 },
        "bugFixed": true,
        "codeQualityImproved": true,
        "code": { "linesAdded": 4, "linesRemoved": 6, "languageChanged": false, "identical": false },
        "reviewedBoth": true,
        "highlights": ["Status improved from Wrong Answer to Accepted.", "Time complexity improved from O(n^2) to O(n)."]
      }
    ],
    "overview": {
      "attemptCount": 2,
      "firstStatus": "Wrong Answer",
      "finalStatus": "Accepted",
      "finalAccepted": true,
      "firstAcceptedAttempt": 2,
      "complexityJourney": ["O(n^2)", "O(n)"],
      "outcome": "improved",
      "explanation": ["Status path: Wrong Answer (attempt 1) → Accepted (attempt 2).", "…"]
    }
  }
}
```

For an attempt that was never reviewed, `reviewed` is `false`, and `timeComplexity`,
`spaceComplexity`, `qualityScore`, `isOptimal`, `approach` are `null` and `patterns` is `[]`; in the
comparison, `algorithmChanged` and `codeQualityImproved` are `null`, complexity `change` is
`"unknown"`, and `reviewedBoth` is `false`. `outcome` is `single-attempt`, `improved`, `regressed`,
or `no-change`.

**Errors:** `404 NOT_FOUND` for an unknown or malformed id; `503 DATABASE_NOT_CONFIGURED`.

### `GET /api/problems/:id/compare?from=1&to=3`

Compares any two attempts of the problem (they need not be adjacent or ordered) and returns one
`AttemptComparison` — the same shape as an entry of `comparisons` above.

| Query | Rule |
| --- | --- |
| `from`, `to` | Required positive integers (attempt numbers). |

**Errors:** `400 VALIDATION_ERROR` for a missing, non-integer, or non-positive number; `404
NOT_FOUND` for an unknown id or an attempt number the problem doesn't have; `503
DATABASE_NOT_CONFIGURED`.

### `GET /api/learning/profile`

```json
{
  "success": true,
  "data": {
    "problems": 4,
    "attempts": 7,
    "reviewedAttempts": 6,
    "sufficientData": true,
    "insights": [
      {
        "id": "repeated-time-limit-exceeded",
        "kind": "weakness",
        "title": "Repeated Time Limit Exceeded",
        "description": "Time Limit Exceeded was the judge's verdict on 3 of 7 recorded attempts, across 2 problem(s).",
        "evidence": { "count": 3, "total": 7, "examples": [{ "submissionId": "…", "title": "Two Sum" }] }
      }
    ],
    "patterns": [
      { "pattern": "Hash Map", "problems": 2, "accepted": 2, "averageQuality": 92, "needingImprovement": 0, "level": "strong" }
    ],
    "notes": ["Only judge status, static analysis, and AI review results are stored, so qualities such as how well a solution is explained are not measured."]
  }
}
```

`insights[].kind` is `weakness` or `strength`; every insight has the `evidence` it rests on.
`patterns` always lists all 16 tracked patterns with a `level` of `strong`, `developing`, `weak`, or
`untouched`. With no submissions: zero counts, `insights: []`, and a note saying nothing has been
recorded. **Errors:** `503 DATABASE_NOT_CONFIGURED`.

### `GET /api/learning/recommendations`

```json
{
  "success": true,
  "data": {
    "practiceMore": [
      {
        "pattern": "Sliding Window",
        "action": "practice",
        "reason": "No Sliding Window problem has been recorded among 4 problems.",
        "evidence": { "count": 0, "total": 4, "examples": [] }
      }
    ],
    "review": [
      {
        "pattern": "Graph",
        "action": "review",
        "reason": "1 of 3 Graph problems Accepted; 2 need improvement.",
        "evidence": { "count": 2, "total": 3, "examples": [] }
      }
    ],
    "sufficientData": true,
    "summary": "Practice more: Sliding Window. Review: Graph."
  }
}
```

Each list holds at most 5 entries. With no submissions both lists are empty and `summary` says
there is nothing to base recommendations on. **Errors:** `503 DATABASE_NOT_CONFIGURED`.

### Changes to existing endpoints

`POST /api/submissions/:id/document` and `/publish` (when a database is configured) may add three
sections to the generated Markdown — `## Submission History`, `## How My Solution Improved`,
`## Recurring Mistakes` — when the history supports them. The response shape is unchanged, and
without a database or when the history lookup fails the document is exactly what it was in
Phase 6/7. See [docs/document-generation.md](document-generation.md).

---

## Not yet implemented

- No `GET /api/submissions` or `GET /api/submissions/:id` — a raw submission can't be fetched
  back directly. The dashboard's [`GET /api/problems`](#get-apiproblems) and
  [`GET /api/problems/:id`](#get-apiproblemsid) are the read paths (they return the problem list
  and a submission's full detail), and `review`/`document`/`publish` look a submission up internally.
- No local document persistence — `POST /api/submissions/:id/document` returns the generated
  Markdown in the response only; nothing is saved to disk. Phase 7's
  `POST /api/submissions/:id/publish` does commit it to GitHub, but only there. See
  [docs/document-generation.md#limitations](document-generation.md#limitations) and
  [docs/github-integration.md#limitations](github-integration.md#limitations).
- No OAuth for GitHub — only a single, manually-issued personal access token
  (`GITHUB_TOKEN`), per the Phase 7 MVP scope. See
  [docs/github-integration.md#future-oauth-design](github-integration.md#future-oauth-design).
- No authentication (not scheduled in any phase yet) — every request is currently trusted as coming from the user's own
  extension; there's no concept of a logged-in user yet.
- No persistence **without a database** — with no `DATABASE_URL`, submissions live in memory and
  are lost on restart, and the dashboard endpoints answer `503`. See
  [docs/database.md](database.md).
- No write endpoints for the dashboard, no pagination on `GET /api/problems` (it returns every
  problem), and no user accounts — everything belongs to the single built-in local user.
- No retry logic or caching for AI review, document, or publish requests — see
  [docs/ai-analysis.md#limitations](ai-analysis.md#limitations) and
  [docs/github-integration.md#limitations](github-integration.md#limitations).
