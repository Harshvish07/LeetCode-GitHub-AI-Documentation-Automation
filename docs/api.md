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
validates it, normalizes it, assigns it a server-side id, and stores it (in-memory — see
[docs/phases/phase-03.md](phases/phase-03.md#limitations) for what that means today). Introduced
in Phase 3.

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

## Not yet implemented

- No `GET /api/submissions` or `GET /api/submissions/:id` — the repository interface supports
  a full read path (`findById` was added in Phase 5), but no endpoint exposes it directly; the
  only current read paths are indirect, via `POST /api/submissions/:id/review`,
  `POST /api/submissions/:id/document`, and `POST /api/submissions/:id/publish`.
- No local document persistence — `POST /api/submissions/:id/document` returns the generated
  Markdown in the response only; nothing is saved to disk. Phase 7's
  `POST /api/submissions/:id/publish` does commit it to GitHub, but only there. See
  [docs/document-generation.md#limitations](document-generation.md#limitations) and
  [docs/github-integration.md#limitations](github-integration.md#limitations).
- No OAuth for GitHub — only a single, manually-issued personal access token
  (`GITHUB_TOKEN`), per the Phase 7 MVP scope. See
  [docs/github-integration.md#future-oauth-design](github-integration.md#future-oauth-design).
- No authentication — every request is currently trusted as coming from the user's own
  extension; there's no concept of a logged-in user yet.
- No persistence beyond the API process's lifetime — see
  [docs/phases/phase-03.md](phases/phase-03.md#limitations).
- No retry logic or caching for AI review, document, or publish requests — see
  [docs/ai-analysis.md#limitations](ai-analysis.md#limitations) and
  [docs/github-integration.md#limitations](github-integration.md#limitations).
