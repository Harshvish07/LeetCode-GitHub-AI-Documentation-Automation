# Phase 3 — Submission API

## Objective

Create the backend API that receives extracted LeetCode submission data from the Chrome
Extension: a `POST /api/submissions` endpoint that validates every field with a schema
(never trusting client input), normalizes it, assigns a unique id, and persists it through a
repository abstraction — in-memory for now, swappable for a real database later without
touching business logic. Update the extension to actually send its extractions there, with
loading/success/failure/validation-error states in the popup. No AI, GitHub integration,
dashboard, authentication, or production database belong to this phase.

## Implementation Summary

- `POST /api/submissions`, layered as routes → middleware (validation) → controllers →
  services → repositories, exactly matching the requested architecture.
- A Zod schema (`apps/api/src/schemas/submission.schema.ts`) that is the actual source of
  truth for what the server accepts — independent of, and stricter in places than, the
  TypeScript wire-contract type, since a type is a compile-time promise a client can simply not
  keep.
- `SubmissionService` (`apps/api/src/services/submissions.service.ts`): normalizes fields,
  assigns a `crypto.randomUUID()` id, records a server-side `receivedAt`, and persists via a
  repository interface.
- `SubmissionRepository` interface + `InMemorySubmissionRepository`
  (`apps/api/src/repositories/submissions.repository.ts`) — the abstraction a real database
  will implement in a later phase.
- Centralized error handling (`apps/api/src/middleware/errorHandler.ts`): every error, expected
  or not, becomes a consistent `ApiResponse` JSON body with an appropriate HTTP status code.
- A dev-appropriate request logger (`apps/api/src/middleware/requestLogger.ts`).
- The extension's popup gained a **Submit Solution** button that extracts fresh data, POSTs it,
  and shows loading/success/validation-error/generic-error states.
- `manifest.json` gained one new, narrowly-scoped permission —
  `host_permissions: ["http://localhost:4000/*"]` — the platform-correct way for an MV3
  extension to call a specific origin without being subject to that origin's CORS policy.
- 32 new API tests (schema, service, repository, and full HTTP-level integration tests) and 6
  new extension tests (the API client), for **123 tests total across the repo** (91 passing at
  the time of writing across all four workspaces, plus the pre-existing Phase 1/2 suites).

## Architecture

```
apps/api/src/
├── routes/
│   ├── index.ts              (modified — composition root, see below)
│   ├── health.route.ts        (unchanged)
│   └── submissions.route.ts    (new)
├── controllers/
│   └── submissions.controller.ts  (new)
├── services/
│   ├── submissions.service.ts      (new)
│   └── submissions.service.test.ts  (new)
├── schemas/
│   ├── submission.schema.ts          (new)
│   └── submission.schema.test.ts      (new)
├── middleware/
│   ├── validateBody.ts                 (new)
│   ├── errorHandler.ts                  (new)
│   └── requestLogger.ts                  (new)
├── repositories/
│   ├── submissions.repository.ts          (new)
│   └── submissions.repository.test.ts      (new)
├── types/
│   └── errors.ts                            (new)
├── app.ts                                     (modified)
└── index.ts                                    (unchanged)
```

**A deliberate deviation from the task's example tree:** the example showed a single
`server.ts` entry point with no `app.ts`. Phase 1 already established `index.ts` (process
bootstrap: env loading, `app.listen()`) + `app.ts` (a testable `createApp()` factory building
the Express app with no port bound) as two separate files, specifically so tests can build an
app instance without a real network port — exactly what every test file in this phase
(`submissions.route.test.ts`, and Phase 1's `health.route.test.ts`) relies on via Supertest.
Renaming/merging them would have broken that pattern for no benefit, so it was kept. Everything
else — `routes/`, `controllers/`, `services/`, `schemas/`, `middleware/`, `types/` — matches the
requested layout. `repositories/` was added because the task explicitly asked for a repository
interface, even though the illustrative example tree didn't list it as its own folder.

### Request flow

```
POST /api/submissions
  → cors, requestLogger, express.json()         (app.ts)
  → validateBody(createSubmissionSchema)          (middleware — 400 on failure, never reaches the controller)
  → controller.createSubmission                    (controllers/submissions.controller.ts)
  → service.createSubmission(input)                  (services/submissions.service.ts)
      → normalize fields
      → randomUUID()
      → repository.create(...)                          (repositories/submissions.repository.ts)
  → 201 { success: true, data: StoredSubmission }
```

Any error anywhere in that chain — a thrown `ApiError`, an unhandled exception, or
`express.json()`'s own `SyntaxError` on malformed JSON — is passed to `next(err)` and lands in
one place: `middleware/errorHandler.ts`, registered last in `app.ts`. No route hand-rolls its
own error response.

## Every Important File — Why It Exists, Where It's Used

### `packages/shared` changes (not `apps/api`, but foundational to it)

- **`src/types/submission.ts`** (new) — `CreateSubmissionRequest` and `StoredSubmission`, the
  wire contract for this endpoint. Reuses `LeetCodeProblemInfo`/`LeetCodeSubmissionInfo`
  from Phase 2 as-is (the request body *is* an extraction's problem/submission data, wrapped
  with `metadata`) rather than redeclaring the same seven fields. **Where used:** the
  extension's `lib/api.ts` constructs a `CreateSubmissionRequest`; the API's controller/service
  return a `StoredSubmission`.
- **`src/types/leetcode.ts`** (modified) — added `LEETCODE_LANGUAGES`/`LeetCodeLanguage`,
  promoted from a local constant in `apps/extension/.../selectors.ts` (Phase 2), since the API
  now needs the exact same whitelist to validate `submission.language` — keeping one copy
  avoids the extractor and the validator silently drifting apart. Also tightened
  `LeetCodeSubmissionInfo.language` from `string | null` to `LeetCodeLanguage | null`.
- **`src/utils/leetcodeUrl.ts`** (new, moved from `apps/extension/src/content/leetcode/url.ts`)
  — `isLeetCodeProblemUrl`/`extractSlugFromUrl`. Moved here so `apps/api`'s schema can validate
  a submitted `problem.url` with the *exact same* check the extension uses to decide it's on a
  problem page in the first place, instead of a second, potentially-diverging regex.
  `apps/extension/src/content/leetcode/url.ts` is now a one-line re-export (see below) — zero
  behavior change to Phase 2's extraction, confirmed by its existing tests still passing.
- **`src/types/api.ts` / `src/utils/apiResponse.ts`** (modified) — `ApiError.error.details?:
  unknown` and `failure(message, code?, details?)` gained an optional third parameter, so
  validation errors can carry an array of per-field issues. Backward compatible: existing
  2-argument `failure()` calls (Phase 1's health endpoint) are unaffected, and `details` is
  omitted from the JSON entirely when not provided (not sent as `null`).

### `apps/extension` changes

- **`src/content/leetcode/url.ts`** (rewritten to a re-export) — now just
  `export { isLeetCodeProblemUrl, extractSlugFromUrl } from '@codereviewai/shared';`. Its own
  test file was trimmed to a two-case smoke test; the exhaustive 11-case behavior suite moved
  to `packages/shared/src/utils/leetcodeUrl.test.ts` alongside the logic itself.
- **`src/content/leetcode/selectors.ts`** (modified) — `KNOWN_LANGUAGES` is now a re-export of
  `@codereviewai/shared`'s `LEETCODE_LANGUAGES` instead of its own local array.
  `extractor.ts`'s `extractLanguage` return type tightened to `LeetCodeLanguage | null` to
  match.
- **`src/lib/api.ts`** (new) — the extension's only network-calling code.
  `toCreateSubmissionRequest(extraction)` maps a Phase 2 `LeetCodeExtraction` onto the wire
  contract (dropping `warnings`, which isn't part of it). `submitSubmission(payload)` POSTs to
  `http://localhost:4000/api/submissions` and returns a typed `SubmitOutcome` —
  `'success' | 'validation-error' | 'error'` — rather than letting callers deal with raw
  `fetch`/HTTP-status branching themselves. **Where used:** `popup.ts`.
- **`src/lib/api.test.ts`** (new) — 6 tests covering the request mapping and all three outcome
  branches (success, validation error with issues, generic server error), plus network-failure
  and non-JSON-response edge cases, all via a stubbed `global.fetch`.
- **`src/popup/popup.html` / `popup.ts` / `popup.css`** (modified) — added a **Submit Solution**
  button and a result panel. Clicking it re-extracts (so it never submits stale data from an
  earlier click), POSTs via `submitSubmission`, and renders one of: a loading message, a success
  message with the returned submission id, a validation-error message listing every
  `path: message` issue the API returned, or a generic failure message (including a specific
  "is the API running?" hint when the `fetch` itself fails, e.g. because the API isn't
  started). The button is disabled while a request is in flight.
- **`manifest.json`** (modified) — added `host_permissions: ["http://localhost:4000/*"]`; see
  §"Security/Privacy Considerations". Version bumped to `0.3.0`.

### `apps/api` — new files

- **`src/schemas/submission.schema.ts`** — see §"Validation" below. Exports
  `createSubmissionSchema` (the Zod schema) and `ValidatedSubmissionInput` (its inferred type —
  deliberately distinct from `@codereviewai/shared`'s `CreateSubmissionRequest`; see the note
  in that section on why). **Where used:** `middleware/validateBody.ts` (route wiring),
  `controllers/submissions.controller.ts` and `services/submissions.service.ts` (typing the
  already-validated input).
- **`src/middleware/validateBody.ts`** — a generic `validateBody<T>(schema: ZodType<T>)`
  Express middleware factory: runs `schema.safeParse(req.body)`, and either replaces `req.body`
  with the parsed result and calls `next()`, or forwards a `ValidationError` to the centralized
  error handler. Generic and reusable — nothing here is submissions-specific, so any future
  endpoint's Zod schema plugs in the same way. **Where used:**
  `routes/submissions.route.ts`.
- **`src/middleware/errorHandler.ts`** — `errorHandler` (the centralized 4-argument Express
  error middleware — Express only recognizes a middleware function as an error handler when its
  arity is exactly 4) maps `ApiError` instances to their declared status/code, `express.json()`'s
  own malformed-JSON `SyntaxError` to `400 MALFORMED_JSON`, and anything else to a logged
  `500 INTERNAL_ERROR` — so no error, expected or not, ever reaches the client as an unhandled
  stack trace. `notFoundHandler` gives unmatched routes the same consistent envelope. **Where
  used:** registered last (in that order) in `app.ts`.
- **`src/middleware/requestLogger.ts`** — logs `METHOD path status durationMs` once each
  response finishes (so the logged status/duration reflect what actually happened, including
  requests the error handler caught). A plain `console.log`, not a structured logger —
  documented as the appropriate scope for local development, with a note to swap it for
  something like pino/winston before this ever ships anywhere log volume or format matters.
  **Where used:** registered early in `app.ts`, before route handling.
- **`src/repositories/submissions.repository.ts`** — `SubmissionRepository` (interface: just
  `create(submission): Promise<StoredSubmission>` — see §"Submission Service & Repository"
  for why it's this minimal) and `InMemorySubmissionRepository` (a `Map`-backed
  implementation). **Where used:** `routes/index.ts` constructs one and injects it into
  `SubmissionService`; tests construct their own (or a small recording fake) for isolation.
- **`src/services/submissions.service.ts`** — `SubmissionService.createSubmission(input)`:
  normalizes (trims whitespace, lowercases the slug, strips the URL's query string/fragment),
  assigns `id` via `crypto.randomUUID()`, records `metadata.receivedAt`, and calls
  `repository.create(...)`. Deliberately does **not** touch `submission.code` beyond what the
  schema already required — reformatting someone's actual source code is not this layer's job.
  **Where used:** `controllers/submissions.controller.ts`.
- **`src/controllers/submissions.controller.ts`** — `createSubmissionsController(service)` is a
  factory (not a module-level object), matching `app.ts`'s existing `createApp(config)`
  dependency-injection shape — this is what lets `routes/index.ts` (and, transitively, every
  test that calls `createApp()`) build a fresh `SubmissionService`/repository per app instance
  instead of sharing state. `createSubmission` is a thin Express handler: read the
  already-validated `req.body`, call the service, respond `201` with the shared `success()`
  envelope, or `next(error)` on failure. **Where used:** `routes/submissions.route.ts`.
- **`src/routes/submissions.route.ts`** — mounts `POST /submissions` (under `/api`, from
  `app.ts`), wiring `validateBody(createSubmissionSchema)` in front of the controller.
- **`src/types/errors.ts`** — `ApiError` (statusCode, code, message, optional details) and
  `ValidationError extends ApiError` (always `400`/`VALIDATION_ERROR`). Placed under `types/`
  (per the task's example tree) rather than a new `errors/` folder, since it's a small,
  self-contained addition. **Where used:** thrown by `validateBody`, caught by
  `errorHandler`.

### `apps/api` — modified files

- **`src/routes/index.ts`** — changed from a module-level `export const router = Router()`
  (Phase 1) to `export function createApiRouter(): Router`, a small composition root that
  builds `InMemorySubmissionRepository` → `SubmissionService` → the submissions controller →
  router, fresh on every call. This is what gives every `createApp()` call (including every
  test's) its own isolated in-memory store, with zero extra test setup required.
- **`src/app.ts`** — added `requestLogger`, switched to `createApiRouter()`, and registered
  `notFoundHandler` + `errorHandler` last.

## Submission Service & Repository

The task asked for a service that "1. validates submission, 2. normalizes fields, 3. creates a
unique submission ID, 4. returns normalized submission data." In this implementation,
responsibility (1) is owned by the Zod schema + `validateBody` middleware layer — by the time
`SubmissionService.createSubmission` runs, `req.body` is already schema-valid — and (2)–(4) are
the service's own job. This split was a deliberate choice, not a way to dodge the requirement:
validation-as-middleware is the idiomatic Express+Zod pattern (fail fast, before any business
logic runs, with one consistent 400 shape for every endpoint that ever adds a schema), and it
keeps the service unit-testable against already-valid fixtures without re-deriving Zod's error
formatting in every test.

The repository interface is **deliberately minimal** — `create()` only, no `findById`/`list`.
Nothing in this phase calls a read method (there's no `GET /api/submissions` route), so adding
one now would be unused code with no test coverage justifying it. The interface is still exactly
what the task asked for — "so database persistence can be added later" — because a database
implementation of `SubmissionRepository` only has to implement what the interface declares
today; read methods get added to the interface in the phase that actually introduces a read
endpoint.

## API Design

See [docs/api.md](../api.md) for the full endpoint reference (request/response shapes,
every error code, examples). One endpoint this phase: `POST /api/submissions`. Design choices
worth calling out here:

- **201, not 200**, on success — a new resource (the stored submission) was created.
- **The response body echoes the normalized data** (not just an id) — the client can show
  exactly what was stored without a follow-up read, and can see normalization's effect (e.g. a
  lowercased slug) directly.
- **`metadata.receivedAt` is server-assigned**, separate from the client-claimed
  `metadata.extractedAt` — the server records its own truth about when it processed the
  request rather than fully trusting a client timestamp, consistent with "never trust client
  input" applying to more than just shape/type validation.

## Validation

`apps/api/src/schemas/submission.schema.ts` is the actual runtime gatekeeper — independent of
whatever TypeScript type a client's code was written against, since nothing stops a modified
extension, a hand-crafted `curl` request, or a bug from sending something a compiler never saw.
Key rules (full table in [docs/api.md](../api.md)):

- `problem.url` must be a syntactically valid URL **and** pass `isLeetCodeProblemUrl` (the same
  check, imported from `@codereviewai/shared`, that the extension itself uses).
- `problem.slug` must match `^[a-z0-9-]+$`.
- `submission.language` / `submission.status` / `problem.difficulty` must each be `null` or an
  exact member of their respective whitelist (`LEETCODE_LANGUAGES`, `LEETCODE_SUBMISSION_STATUSES`,
  `['Easy','Medium','Hard']`) — an unrecognized value is rejected, not silently accepted.
- `submission.code` is **required** (non-empty after trimming) — the one field Phase 2 treats
  as nullable-but-honest that this schema treats as mandatory, because a submission record with
  no code isn't meaningfully a submission. This is a deliberate, documented business rule, not
  an oversight.
- `metadata.extractedAt` must be a valid ISO 8601 datetime string; `metadata.source` must be
  exactly `"extension"`.

**A type-modeling note surfaced while building this:** the schema's inferred type
(`ValidatedSubmissionInput`) is *not* the same TypeScript type as
`@codereviewai/shared`'s `CreateSubmissionRequest`, even though they describe "the same"
request. `CreateSubmissionRequest` reuses `LeetCodeProblemInfo`/`LeetCodeSubmissionInfo`
verbatim, which allow `slug`/`title` to be `null` (because Phase 2 extraction can legitimately
fail to find them) — but the schema *requires* them. Typing the controller/service against the
wire-level shared type caused a real compile error (`'input.problem.slug' is possibly 'null'`)
that surfaced this exact gap. The fix: the schema exports its own, stricter inferred type, and
the controller/service use *that* — an accurate reflection of "this has already been validated
and is stricter than the raw wire contract," rather than force-loosening the schema (or
force-widening the shared type) to make two genuinely-different-strictness shapes pretend to be
identical.

## Error Handling

Every response, success or failure, uses the same `ApiResponse<T>` envelope from Phase 1
(extended in this phase with optional `error.details`). One centralized error handler
(`middleware/errorHandler.ts`, registered last) is the only place that decides HTTP status
codes for failures:

| Source | Status | Code |
| --- | --- | --- |
| `ValidationError` (thrown by `validateBody`) | 400 | `VALIDATION_ERROR` |
| `express.json()`'s `SyntaxError` on malformed JSON | 400 | `MALFORMED_JSON` |
| No route matched (`notFoundHandler`) | 404 | `NOT_FOUND` |
| Any other thrown/unhandled error | 500 | `INTERNAL_ERROR` (logged server-side via `console.error`) |

No controller or route ever calls `res.status(...).json(...)` for an error case directly — they
either don't fail (validation already happened) or call `next(error)`/throw and let the
centralized handler decide.

## Security/Privacy Considerations

- **One new, narrowly-scoped permission.** `manifest.json` gained
  `host_permissions: ["http://localhost:4000/*"]` — needed because an MV3 extension calling a
  cross-origin URL from its popup is otherwise subject to the same CORS restrictions a normal
  webpage would face, and a `chrome-extension://<random-id>` origin can never be added to a
  server's `CORS_ORIGIN` allowlist in advance (unpacked extension IDs aren't stable/known
  ahead of time). Declaring `host_permissions` for a specific origin is the platform-correct
  mechanism: Chrome trusts the extension's declared permission and bypasses CORS for that
  origin, so the API's own CORS config didn't need to change (and wasn't changed) to
  accommodate the extension. The permission is scoped to exactly `localhost:4000`, not a broad
  `<all_urls>` grant — documented here as a dev-only value that a real deployment would replace
  with the API's actual origin.
- **Never trust client input, beyond just types.** The Zod schema is independent of the
  TypeScript contract; a URL is checked against the real LeetCode-URL predicate, not just
  "is a URL"; enums are checked against exact whitelists, not just "is a string."
- **The server records its own timestamp** (`metadata.receivedAt`) rather than only trusting
  the client-supplied `metadata.extractedAt`.
- **No secrets are involved yet** — no API keys, no auth tokens. The "secrets stay server-side"
  principle from `docs/architecture.md` remains the rule for the AI/GitHub phases that will
  introduce them.
- **Submitted code is stored, not executed.** Nothing in this phase parses, evaluates, or
  otherwise runs any part of a submitted payload — it's treated as opaque string data
  throughout.

## Testing

32 new API tests, across 5 test files:

- **`schemas/submission.schema.test.ts`** (14 tests) — every rule above, both accept and reject
  cases: a fully valid payload; all nullable fields explicitly `null`; missing `submission.code`;
  empty-string `submission.code`; an unknown language; a malformed URL; a well-formed
  non-LeetCode URL; an unknown status; an unknown difficulty; a missing `problem.title`; an
  invalid `extractedAt`; a `metadata.source` other than `"extension"`; a completely
  wrong-shaped payload (an array); a payload missing entire top-level sections.
- **`services/submissions.service.test.ts`** (6 tests) — normalization (whitespace, slug
  casing), that submitted code is preserved *exactly* (not trimmed/reformatted), unique-id
  assignment across two calls, the server-assigned `receivedAt` independent of the client's
  `extractedAt`, that the service calls the repository with exactly what it returns (via a
  small recording fake repository), and that nullable fields stay `null` rather than being
  turned into an invented value.
- **`repositories/submissions.repository.test.ts`** (2 tests) — round-trips a submission
  through `create()`, and confirms two different ids stay independent.
- **`routes/submissions.route.test.ts`** (10 tests) — full HTTP-level integration via Supertest
  against `createApp()`: a valid submission returns 201 with the expected shape; two
  submissions get different ids; an invalid submission returns 400 with `details`; missing
  code, invalid language, and invalid URL each return 400; a wrong-shape payload returns 400;
  syntactically invalid JSON returns 400 `MALFORMED_JSON` (not a raw 500); an unknown route
  returns a consistent 404 envelope.

6 new extension tests (**`lib/api.test.ts`**): the extraction-to-request mapping (and that
`warnings` is dropped); success, validation-error, and generic-error outcome branches; a
network-failure case (`fetch` itself rejecting); a non-JSON-response case.

Every existing Phase 1/2 test continued to pass unmodified (with Phase 2's `url.ts` tests
trimmed to a smoke test after the logic moved to `packages/shared`, as described above).

## Commands

```bash
npm install                                  # rebuilds shared, installs zod/@types/node additions
npm run typecheck                            # all 4 workspaces
npm run test                                 # all 4 workspaces (91 tests total)
npm run test -w @codereviewai/api             # just the API (32 tests)
npm run test -w @codereviewai/extension        # just the extension (41 tests)
npm run lint
npm run format
npm run build                                 # shared → api/web/extension
npm run start -w @codereviewai/api             # run the production build directly
```

## Verification

Performed against this repository as part of completing Phase 3:

1. `npm install` — succeeds, 0 vulnerabilities.
2. `npm run typecheck` — passes in all 4 workspaces.
3. `npm run test` — 91/91 tests pass across all 4 workspaces (32 API + 41 extension + 2 web +
   16 shared).
4. `npm run lint` — 0 errors, 0 warnings.
5. `npm run format:check` — all files match Prettier style.
6. `npm run build` — all 4 packages build; confirmed no `*.test.*` files leak into any `dist/`
   output; confirmed `apps/extension/dist/manifest.json` carries the new
   `host_permissions` entry.
7. Started the **production** API build (`node dist/index.js`, not the dev server) and, via
   `curl`, confirmed: `GET /api/health` still works; a valid `POST /api/submissions` returns
   201 with a normalized, id-assigned submission; a submission missing `submission.code`
   returns a 400 with the expected `VALIDATION_ERROR` detail; the request logger printed a
   `METHOD path status durationMs` line for each of these.
8. Stopped all background dev/start processes after verification; confirmed no stray processes
   left listening on port 4000.

**Not performed:** loading the built extension into an actual Chrome window and clicking
**Submit Solution** against a live LeetCode page with the API running — no browser automation
was available in this environment (the same limitation noted in Phase 2). The extension→API
integration was verified at the unit level (`lib/api.test.ts`, stubbing `fetch`) and the
API was verified directly via `curl`/Supertest; the two were not exercised together through an
actual browser. This is the most important manual follow-up before relying on the full pipeline.

## Limitations

- **In-memory persistence only.** `InMemorySubmissionRepository` stores submissions in a
  `Map` that's discarded when the API process exits — nothing survives a restart. This was
  explicit scope: "persistence can be in-memory... do NOT introduce PostgreSQL yet unless
  genuinely required." A real database is Phase 4.
- **No read endpoints.** A submission can be created but not listed or fetched by id yet — see
  "Submission Service & Repository" above for why the repository interface stayed
  read-method-free for now.
- **The extension→API path was not exercised end-to-end in a real browser** — see
  "Verification" above.
- **`host_permissions` is hardcoded to `localhost:4000`.** A real deployment will need this
  (and `lib/api.ts`'s `API_BASE_URL`) updated to point at a real API origin — noted here as a
  known, deliberate dev-only value, not an oversight.
- Everything explicitly out of scope for this phase (AI, GitHub integration, dashboard,
  authentication, production database) remains unimplemented.

## What Phase 4 Will Implement

Per the roadmap in the README, Phase 4 introduces a real persistence layer (a database — likely
PostgreSQL or SQLite for a portfolio deployment) implementing this phase's
`SubmissionRepository` interface, replacing `InMemorySubmissionRepository` without any change to
`SubmissionService`, the controller, or the route. It will likely also be the natural point to
add a `GET /api/submissions` (and/or `GET /api/submissions/:id`) read endpoint, extending the
repository interface with the read method(s) that endpoint needs.
