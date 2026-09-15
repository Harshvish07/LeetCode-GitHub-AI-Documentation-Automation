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

## Not yet implemented

- No `GET /api/submissions` or `GET /api/submissions/:id` — the repository interface supports
  adding a read path later (see [architecture.md](architecture.md)), but no read endpoint
  exists yet.
- No authentication — every request is currently trusted as coming from the user's own
  extension; there's no concept of a logged-in user yet.
- No persistence beyond the API process's lifetime — see
  [docs/phases/phase-03.md](phases/phase-03.md#limitations).
