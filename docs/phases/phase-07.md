# Phase 7 — GitHub Integration

## Objective

Automatically publish the Markdown learning document Phase 6 already knows how to generate to a
GitHub repository — a full `problems/NNN-slug/README.md` per problem, an auto-maintained root
`README.md` table, structured commits, and explicit duplicate handling — without OAuth (token
env var only, with an abstraction ready for OAuth later).

## Implementation Summary

A new `apps/api/src/github/` module wraps `@octokit/rest` behind a small `GitHubClient`
interface (mirroring Phase 5's `AiProvider` abstraction exactly) and a set of single-purpose
services (`repository.service.ts`, `file.service.ts`, `commit.service.ts`). A new
`services/github-publish.service.ts` orchestrates one publish: repository pre-flight check,
duplicate detection via the target file's existence, an explicit create-vs-update contract, and
keeping a small `problems/index.json` and the root README's auto-generated table in sync — all
without ever silently overwriting a previously published problem. A new
`POST /api/submissions/:id/publish` endpoint exposes it, reusing Phase 5/6's exact
`buildCombinedReview()` → `generateDocument()` pipeline. See
[docs/github-integration.md](../github-integration.md) for the full design.

## Complete Workflow

```
LeetCode problem page
  → apps/extension (content script extracts problem + submission)
  → POST /api/submissions (Phase 3 — validated, normalized, stored)
  → POST /api/submissions/:id/publish (Phase 7)
       → buildCombinedReview() (shared with Phase 5/6):
            analyzeSolution() (Phase 4, packages/analysis)
            → AiReviewService.generateReview() (Phase 5, ai/)
            → compareAnalyses() (Phase 5, ai/agreement.ts)
       → generateDocument() (Phase 6, document/) → { filename, content }
       → GitHubPublishService.publish():
            RepositoryService.ensureAccessible()        — repository lookup
            FileService.findExisting(problemPath)         — duplicate detection
            (mode="create" + exists) → reject, CONFLICT
            (mode="update" + !exists) → reject, NOT_FOUND
            (content unchanged) → status: "unchanged", no writes
            FileService.create()/update() problem README  — commit 1
            update problems/index.json                     — commit 2
            re-render + merge root README table             — commit 3
  → 200 { status, path, commitUrl, index: {...}, readme: {...} }
```

Everything above `POST /api/submissions/:id/publish` is unchanged from Phases 3–6; this phase
adds only the final step and the small, shared `buildCombinedReview()`/`generateDocument()`
calls that step needed (both already existed).

## Every Important File

### `apps/api/src/github/types.ts`

**Why:** the task requires abstracting GitHub operations behind an interface (mirroring
`AiProvider`) so the rest of the system never depends on Octokit directly, and so a future
implementation (a different Git host, a lower-level Git Data API client) is a drop-in
replacement.
**What:** `GitHubClient` (`getRepository()`, `getFile()`, `writeFile()`),
`GitHubAuthProvider` (`getToken()`), and their supporting shapes (`GitHubFile`,
`WriteFileInput`/`Result`, `GitHubRepositoryInfo`).
**Where used:** every other file in `github/`, plus `services/github-publish.service.ts`.

### `apps/api/src/github/errors.ts`

**Why/what:** `GitHubError` — one error type for every GitHub failure mode
(`AUTH_FAILED`/`NOT_FOUND`/`RATE_LIMITED`/`CONFLICT`/`API_ERROR`), HTTP-agnostic, mirroring
`ai/errors.ts`'s `AiReviewError` exactly.
**Where used:** `github-client.ts` (maps Octokit/HTTP errors into it),
`github-publish.service.ts` (throws it directly for `CONFLICT`/`NOT_FOUND` duplicate-handling
decisions), `controllers/githubErrorMapping.ts` (maps it to an HTTP status).

### `apps/api/src/github/auth.ts`

**Why:** the task requires "never store GitHub tokens in source code," "use environment
variables for the MVP," and "prepare an abstraction that can later support OAuth" — this file is
both the MVP implementation and the seam a future OAuth implementation plugs into.
**What:** `createEnvTokenAuthProvider({ token })` — implements `GitHubAuthProvider` by returning
a single env-sourced token, or rejecting with `AUTH_FAILED` if unset.
**Where used:** `github/createGitHubClientFromEnv.ts`.
**Future dependencies:** a Phase 9+ OAuth implementation would be a new file
(`createOAuthProvider()`) implementing the same `GitHubAuthProvider` interface — see
[docs/github-integration.md#future-oauth-design](../github-integration.md#future-oauth-design).

### `apps/api/src/github/github-client.ts`

**Why:** the one real `GitHubClient` implementation, and the only file in this codebase allowed
to import `@octokit/rest` — same dependency-inversion discipline as
`ai/providers/anthropicProvider.ts`.
**What:** `createGitHubClient(config)` — a **synchronous** factory (deliberately, matching
`createAnthropicProvider`/`createGeminiProvider`) that never eagerly fetches a token or
constructs Octokit; the token is resolved and Octokit constructed lazily, once, on the first
actual method call. Maps Octokit's `RequestError.status` to the right `GitHubError` code (401→
`AUTH_FAILED`, 403→`RATE_LIMITED`, 404→`NOT_FOUND` or, for `getFile()`, a clean `null`, 409→
`CONFLICT`, else→`API_ERROR`).
**Where used:** `github/createGitHubClientFromEnv.ts`.
**Depends on:** `@octokit/rest` (the only file that does).

### `apps/api/src/github/createGitHubClientFromEnv.ts`

**Why:** the single place that knows `GITHUB_TOKEN`/`GITHUB_REPO` exist, mirroring
`ai/providers/createProviderFromEnv.ts`.
**What:** parses `GITHUB_REPO` as `"owner/repo"`; if unset or malformed, returns a client whose
every method rejects with one clear, diagnosable error (rather than a confusing downstream 404
against `/repos//`) instead of throwing synchronously — the whole API must still start with no
GitHub configuration present.
**Where used:** `routes/index.ts`'s composition root.

### `apps/api/src/github/mockGitHubClient.ts`

**Why:** the task requires "mock the GitHub API" for every test — this is the test/dev-only
`GitHubClient` every other test in this repository uses instead of a real network call.
**What:** `createInMemoryGitHubClient(initialFiles?)` — a `Map`-backed fake supporting
`getFile`/`writeFile`/`getRepository`, with a `writes`/`writeInputs` inspection log for
asserting exactly what was committed and with what message; `createFailingGitHubClient(error)`
— every method rejects with the given error, for failure-path tests.
**Where used:** every `github/*.test.ts` and `services/github-publish.service.test.ts` and
`routes/publish.route.test.ts`. Excluded from the production build
(`apps/api/tsconfig.build.json`) — the same bug class Phase 5's `mockProvider.ts` hit once and
was fixed for; caught and fixed for this file before it shipped (see
[Errors and fixes](#verification) below).

### `apps/api/src/github/repository.service.ts`

**Why/what:** the task's "repository lookup" as its own named, testable operation —
`RepositoryService.ensureAccessible()` calls `client.getRepository()` and lets any
`GitHubError` (404 not found, 401 auth failed) propagate unchanged. Called first, before any
file operation, in every publish.
**Where used:** `services/github-publish.service.ts`.

### `apps/api/src/github/file.service.ts`

**Why/what:** the building block duplicate detection is built on —
`FileService.findExisting(path)` returning non-null means the path is taken; `create()`/
`update()` mechanically decide create-vs-update by whether a `sha` is passed. The *policy* of
whether an update is allowed lives one layer up, in `GitHubPublishService` — this class only
ever does what it's told.
**Where used:** `services/github-publish.service.ts`.

### `apps/api/src/github/commit.service.ts`

**Why:** the task requires "create meaningful commits... do not create meaningless commit
messages," with the explicit example `"docs: add analysis for Two Sum"` — kept as isolated, pure
string-building (mirroring `ai/prompts/reviewPrompt.ts`) so there is exactly one place commit
text is decided and tested.
**What:** `CommitService.buildMessage({ action, title })` — four actions
(`add-problem`/`update-problem`/`update-index`/`update-readme`), each producing a
`docs:`-prefixed, problem-specific message; never a generic one.
**Where used:** `services/github-publish.service.ts`.

### `apps/api/src/github/problemPath.ts`

**Why:** the task's required repository layout is `problems/NNN-slug/README.md` — a nested
folder+README, distinct from Phase 6's own flat `NNN-slug.md` filename choice.
**What:** `buildProblemRepoPath()` reuses Phase 6's `document/formatter/filename.ts`
(`generateDocumentFilename()`) and nests it under `problems/.../README.md` — exactly the reuse
[docs/phases/phase-06.md](phase-06.md#what-phase-7-will-implement) predicted, so
slug-sanitization/path-traversal-safety logic only lives in one place. Also exports the fixed
`PROBLEMS_INDEX_PATH` (`problems/index.json`) and `ROOT_README_PATH` (`README.md`) constants.
**Where used:** `services/github-publish.service.ts`.

### `apps/api/src/github/readmeTable.ts`

**Why:** the task requires an automatic root-README table that "does not destroy manually
written sections," using "clear markers if automated content is inserted."
**What:** `renderProblemsTable(entries)` renders a GFM table (sorted by problem number, unknown
numbers last) using two new primitives added to `document/markdown/markdown.ts` in this phase
(`table()`, `tableCell()` — pipe/newline-safe cell escaping, reusing the same `escapeMarkdown()`
Phase 6 already built). `mergeProblemsTableIntoReadme(existingReadme, entries)` replaces only
the content between `<!-- codereviewai:problems-table:start/end -->` markers — appending them
(never overwriting anything) the first time, and scaffolding a minimal default README only when
none exists at all.
**Where used:** `services/github-publish.service.ts`.

### `apps/api/src/services/github-publish.service.ts`

**Why:** the orchestrator — the one place that spans `github/` and Phase 6's `document/`
together, so `controllers/publish.controller.ts` never has to. Mirrors
`combined-review.service.ts`'s role in Phase 6.
**What:** `GitHubPublishService.publish(input)` — the full duplicate-detection and
create/update state machine (see [docs/github-integration.md#duplicate-handling](../github-integration.md#duplicate-handling)
for the exact table), then upserts `problems/index.json` and re-renders/merges the root README,
skipping any write whose content would be unchanged.
**Where used:** `controllers/publish.controller.ts`, constructed once per `createApiRouter()`
call in `routes/index.ts`.

### `apps/api/src/controllers/githubErrorMapping.ts`

**Why/what:** translates a `GitHubError` to the HTTP-facing `ApiError`
(`AUTH_FAILED`→502, `NOT_FOUND`→404, `RATE_LIMITED`→429, `CONFLICT`→409, `API_ERROR`→502),
falling through to Phase 5's `mapAiErrorToApiError()` for anything that isn't a `GitHubError` —
publishing also runs the AI-review pipeline and can fail for any of *its* reasons too.
**Where used:** `controllers/publish.controller.ts`.

### `apps/api/src/schemas/publish.schema.ts`

**Why/what:** `publishRequestSchema` — the Zod contract for `POST /api/submissions/:id/publish`'s
body, `{ mode?: "create" | "update" }`. The explicit, typed way a caller states intent to
overwrite an already-published problem, matching the project's established discipline (Zod is
the real runtime contract, not just the TypeScript type) since Phase 3.
**Where used:** `routes/publish.route.ts` (via `middleware/validateBody.ts`).

### `apps/api/src/controllers/publish.controller.ts`

**Why:** the HTTP-facing entry point — deliberately thin: it never imports anything from
`github/` directly, only `GitHubPublishService`.
**What:** looks up the submission (404 if missing), builds the review and document (Phase 5/6's
exact pipeline), calls `GitHubPublishService.publish()` with the request's `mode`, responds
`200` with the `PublishResult`; any error goes through `mapPublishErrorToApiError()`.
**Where used:** `routes/publish.route.ts`.

### `apps/api/src/routes/publish.route.ts`

**Why/what:** mounts `POST /submissions/:id/publish`, validated by `publishRequestSchema`.
**Where used:** `routes/index.ts`.

### Modified: `apps/api/src/document/markdown/markdown.ts`

**What changed:** added `tableCell()` (escapes `|` and collapses newlines, on top of the
existing `escapeMarkdown()`) and `table()` (renders a GFM table from pre-escaped cells) — Phase
6 deliberately avoided tables entirely; Phase 7's root-README requirement needed one, so the
escaping discipline was extended rather than duplicated in `github/readmeTable.ts`.

### Modified: `apps/api/src/routes/index.ts`, `apps/api/src/app.ts`

**What changed:** `ApiRouterDeps`/`AppConfig` gained an optional `githubClient` override
(test-only, mirroring `aiProvider`); `routes/index.ts` constructs the real client via
`createGitHubClientFromEnv()` when no override is given, builds `GitHubPublishService`, and
mounts the publish router — reusing the same `submissionService`/`reviewService` instances
already built for the review/document controllers.

### Modified: `apps/api/tsconfig.build.json`

**What changed:** added `src/github/mockGitHubClient.ts` to the exclude list — caught during
this phase's own build verification (see [Verification](#verification) below), the same bug
class `mockProvider.ts` needed the same fix for in Phase 5.

## Testing

83 new tests across 11 new/modified test files, all offline (no network calls — every
GitHub-facing test uses `github/mockGitHubClient.ts` or an injected mock `fetch`, never
`vi.stubGlobal` on the real global, and never a real GitHub API call):

- **`github/auth.test.ts`** (2 tests) — resolves the configured token; rejects `AUTH_FAILED`
  when unset.
- **`github/github-client.test.ts`** (12 tests) — the synchronous-factory contract (no
  fetch/token touched until a method is called); repository lookup success and every error
  status (401/403/404/500); `getFile()` decoding and its 404→`null` special case; `writeFile()`
  create (no `sha`) vs. update (`sha` included) request shapes, and a 409 conflict; token fetched
  and cached exactly once across multiple calls.
- **`github/repository.service.test.ts`** (3 tests) — successful lookup; `NOT_FOUND` and
  `AUTH_FAILED` propagated unchanged (authentication failure).
- **`github/file.service.test.ts`** (7 tests) — duplicate detection (found vs. not found); file
  creation (no `sha` sent); file update (current `sha` sent); API errors on both read and write.
- **`github/commit.service.test.ts`** (7 tests) — the exact task-example message; distinct
  update/index/README messages; a direct assertion that no generic message is ever produced;
  whitespace normalization; the missing-title fallback.
- **`github/problemPath.test.ts`** (4 tests) — the nested `problems/NNN-slug/README.md` shape;
  unknown-number omission; path-traversal-shaped-slug sanitization (reusing Phase 6's
  `filename.ts`, tested here to confirm the reuse actually behaves the same way).
- **`github/readmeTable.test.ts`** (10 tests) — placeholder for zero entries; header/row
  rendering; sort-by-number with unknown-numbers-last; null/empty-field fallbacks; pipe-character
  escaping; the three `mergeProblemsTableIntoReadme()` cases (no README yet, no markers yet,
  markers already present — asserting hand-written content survives byte-for-byte); repeated
  merges never duplicating the markers.
- **`github/createGitHubClientFromEnv.test.ts`** (5 tests) — valid config; unset/malformed
  `GITHUB_REPO` (no slash, too many segments) all reject clearly; the factory itself never
  throws synchronously.
- **`document/markdown/markdown.test.ts`** (+5 tests) — the new `tableCell()`/`table()`
  primitives.
- **`services/github-publish.service.test.ts`** (14 tests) — the full orchestrator: create-mode
  success (problem file + index + README all created, with the exact task-example commit
  message); create-mode rejected as `CONFLICT` when the problem already exists, with zero writes
  performed; default-to-create when `mode` is omitted; update-mode success (correct message,
  correct `sha` passed); update-mode rejected as `NOT_FOUND` when nothing exists yet; the
  byte-identical-content no-op path (status `"unchanged"`, zero writes); repository-lookup,
  authentication, and generic API errors all propagated unchanged.
- **`routes/publish.route.test.ts`** (9 tests) — full HTTP integration via Supertest: 200 for a
  new publish; 409 for a duplicate in create mode; 200/"updated" for an explicit update; 404 when
  updating a nonexistent problem; 400 `VALIDATION_ERROR` for an invalid `mode` value; 404 for an
  unknown submission id; 502 for a GitHub auth failure; 502 for a generic GitHub API error; and
  confirmation that an AI-side failure (malformed response) maps identically to how the review
  endpoint reports it.
- **`schemas/publish.schema.test.ts`** (5 tests) — the request-body contract itself.

Every pre-existing Phase 1–6 test file was re-run unmodified and still passes.

## Commands

```bash
npm run test -w @codereviewai/api      # 269 tests, api workspace
npm run test                            # 401 tests, full repo
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Verification

1. Installed `@octokit/rest` (confirmed npm registry access first with `npm view @octokit/rest
   version`), added as an `apps/api` dependency.
2. Wrote and ran each `github/*` test file incrementally as it was built, rather than all at
   once at the end — every file passed on its first full run except one bug, caught immediately:
   a JS default-parameter pitfall in an early draft of `github-client.test.ts` (calling a test
   helper with an explicit `undefined` argument silently fell back to the helper's own default
   value, since JS default parameters activate on explicit `undefined` too) — fixed by
   constructing the auth provider directly in that one test instead of through the helper.
3. **A real architectural correction made mid-phase:** the first draft of `createGitHubClient()`
   was `async` and fetched the token eagerly at construction time — this would have broken the
   established "the whole API starts cleanly with no key configured" pattern from Phase 5,
   since `routes/index.ts`'s composition root is synchronous. Caught before writing the
   composition-root wiring, not after; refactored to the synchronous, lazy-token-fetch pattern
   documented in [docs/github-integration.md](../github-integration.md#creategithubclient-is-a-synchronous-factory-that-fails-lazily),
   and `github-client.test.ts` was rewritten to match (no `await` on the factory call itself).
4. Ran `npm run typecheck` after each major addition (the schema, the client, the orchestrator,
   the controller/route wiring) to catch type errors incrementally.
5. Ran the full `apps/api` suite, then the whole repo — all green (401 tests across 5
   workspaces).
6. `npm run build`, then `find apps/api/dist -iname "*mock*"` — caught `mockGitHubClient.js`
   present in the build output on the first attempt (the same class of bug Phase 5's
   `mockProvider.ts` hit); fixed by adding it to `apps/api/tsconfig.build.json`'s exclude list
   and confirmed clean on rebuild.
7. `npm run lint` / `npm run format:check` — clean after one `prettier --write` pass over the
   newly created files.

**Not performed:** an actual, real call to the GitHub API — no GitHub token was available (or
appropriate to use, given a real commit's permanence) in this environment. See
[docs/github-integration.md#limitations](../github-integration.md#limitations).

## Limitations

See [docs/github-integration.md#limitations](../github-integration.md#limitations) for the full
list. Specific to this phase's scope:

- OAuth is not implemented — only its abstraction (`GitHubAuthProvider`) and a design sketch, as
  explicitly required ("prepare an abstraction that can later support OAuth," not "implement
  OAuth").
- `patterns/` is unimplemented, per the task's explicit "do not overbuild" instruction.
- A publish is up to three separate, non-atomic commits (problem document, index, README), not
  one — an MVP trade-off against the lower-level Git Data API.

## What Phase 8 Will Implement

Per the roadmap in the README, Phase 8 introduces a web dashboard for browsing past submissions
and generated documents — likely the point where real (database) persistence finally lands too,
since a dashboard is the first feature that actually needs to read submissions/reviews/documents
back after the API process restarts, which `InMemorySubmissionRepository` cannot do.
