# GitHub Integration

This document explains the GitHub publishing layer added in Phase 7: how it talks to GitHub,
how authentication and tokens are handled, the repository layout it produces, its commit
process, and how it handles a problem being published more than once. For the endpoint's
request/response shape, see [docs/api.md](api.md#post-apisubmissionsidpublish). For the full
phase record (every file, why it exists, exact test coverage), see
[docs/phases/phase-07.md](phases/phase-07.md).

## GitHub API

Every GitHub call goes through [`@octokit/rest`](https://github.com/octokit/rest.js), the
official GitHub REST API client, isolated inside a single file:
`apps/api/src/github/github-client.ts` is the *only* file in this codebase that imports
`@octokit/rest` — everything else, including every test, depends only on the `GitHubClient`
interface (`github/types.ts`):

```ts
interface GitHubClient {
  getRepository(): Promise<{ defaultBranch: string }>;
  getFile(path: string): Promise<{ content: string; sha: string } | null>;
  writeFile(input: {
    path: string;
    content: string;
    message: string;
    sha?: string;
  }): Promise<{ sha: string; commitSha: string; commitUrl: string }>;
}
```

This is the exact same dependency-inversion shape Phase 5 used for `AiProvider` — one interface,
one real implementation, one test-only mock (`github/mockGitHubClient.ts`, excluded from the
production build the same way `ai/providers/mockProvider.ts` is). Three GitHub REST operations
back it: `GET /repos/{owner}/{repo}` (repository lookup), `GET /repos/{owner}/{repo}/contents/{path}`
(read a file — used for duplicate detection and to fetch a file's current `sha`), and
`PUT /repos/{owner}/{repo}/contents/{path}` (create or update a file — GitHub's Contents API
creates exactly one commit per call, with or without a `sha` deciding create vs. update).

```
apps/api/src/github/
├── types.ts                     GitHubClient / GitHubAuthProvider interfaces
├── errors.ts                     GitHubError — one error type for every GitHub failure mode
├── auth.ts                        createEnvTokenAuthProvider() — the MVP token auth provider
├── github-client.ts                The one real GitHubClient implementation (Octokit)
├── createGitHubClientFromEnv.ts      Reads GITHUB_TOKEN/GITHUB_REPO, builds the real client
├── mockGitHubClient.ts               Test-only fakes — never wired into the real app
├── repository.service.ts              Repository-level operations (the pre-flight lookup)
├── file.service.ts                     File-level read/create/update
├── commit.service.ts                    Commit-message construction
├── problemPath.ts                        Repo path-building for a problem's document
└── readmeTable.ts                         Root-README table rendering + marker-based merge
```

`apps/api/src/services/github-publish.service.ts` (outside `github/`, alongside Phase 6's
`combined-review.service.ts`) is the orchestrator — the one place that spans `github/` and
`document/` together: duplicate detection, the create/update decision, and keeping
`problems/index.json` and the root `README.md` in sync all live there, never inside a
controller.

## Authentication and token handling

**MVP: a single long-lived token, from an environment variable, read exactly once.**
`github/auth.ts`'s `createEnvTokenAuthProvider({ token })` implements the one-method
`GitHubAuthProvider` interface (`getToken(): Promise<string>`) by returning `GITHUB_TOKEN`
as-is, or rejecting with a `GitHubError('AUTH_FAILED', ...)` if it's unset. This directly
satisfies the task's explicit requirements:

- **"Never store GitHub tokens in source code."** The token exists only as `process.env.GITHUB_TOKEN`,
  read in exactly one place (`github/createGitHubClientFromEnv.ts`); it is never hardcoded,
  logged, or serialized into any response.
- **"Use environment variables for the MVP."** `.env.example` documents `GITHUB_TOKEN`/
  `GITHUB_REPO`, matching every other secret in this project (`AI_PROVIDER_API_KEY`).
- **"Never expose tokens to the frontend."** The token is read server-side only, inside
  `apps/api`; nothing in `apps/web` or `apps/extension` has any code path that could read it —
  the same verified property Phase 5 established for `AI_PROVIDER_API_KEY`.

### `createGitHubClient()` is a synchronous factory that fails lazily

Unlike a naive implementation, `github-client.ts`'s `createGitHubClient()` does **not** eagerly
fetch the token or construct an Octokit instance when called — it returns a `GitHubClient`
immediately, and only resolves the token (once, cached for the client's lifetime) the first time
one of `getRepository()`/`getFile()`/`writeFile()` is actually called. This mirrors
`ai/providers/createProviderFromEnv.ts`'s exact pattern for the AI providers, and for the same
reason: **the whole API must still start cleanly with no `GITHUB_TOKEN`/`GITHUB_REPO`
configured** — only an actual publish attempt fails, clearly, with a specific error, rather than
the entire server refusing to boot. `createGitHubClientFromEnv.ts` extends this: even a
malformed `GITHUB_REPO` (missing the `owner/repo` slash, or the variable unset entirely) returns
a client whose every method rejects with one clear, diagnosable `AUTH_FAILED` message — never a
confusing downstream 404 against `/repos//`.

## Future OAuth design

`GitHubAuthProvider` is deliberately its own interface, separate from `GitHubClient` — *how* a
token is obtained is kept independent of *what you can do* once authenticated:

```ts
interface GitHubAuthProvider {
  getToken(): Promise<string>;
}
```

`getToken()` is `async` even though the MVP implementation resolves synchronously from an env
var, specifically so a future OAuth implementation — one that needs to check whether a per-user
token has expired and refresh it over the network before returning — is a **new file
implementing the same interface**, not a change to `github-client.ts`'s request logic, error
mapping, or any of `repository.service.ts`/`file.service.ts`/`commit.service.ts`. A sketch of
what that future implementation would look like:

```ts
export function createOAuthProvider(config: {
  userId: string;
  tokenStore: OAuthTokenStore; // wherever refresh tokens live once accounts exist (not yet scheduled)
}): GitHubAuthProvider {
  return {
    async getToken() {
      const stored = await config.tokenStore.get(config.userId);
      if (isExpired(stored)) return refreshAndStore(config.tokenStore, stored);
      return stored.accessToken;
    },
  };
}
```

`routes/index.ts`'s composition root would then pick `createEnvTokenAuthProvider` or
`createOAuthProvider` based on whichever auth mode is configured — `github-client.ts` itself
would need zero changes, since it only ever calls `authProvider.getToken()`.

## Repository structure

A publish writes into the target repository like this:

```
leetcode-ai-journal/
├── README.md                          auto-maintained table (see below)
├── problems/
│   ├── 001-two-sum/
│   │   └── README.md                  the full Phase 6 document, unmodified
│   ├── 003-longest-substring/
│   │   └── README.md
│   ├── index.json                     structured metadata for every published problem
│   └── ...
└── patterns/                          reserved for a future phase — nothing writes here yet
```

`github/problemPath.ts`'s `buildProblemRepoPath()` computes `problems/NNN-slug/README.md` by
reusing Phase 6's `document/formatter/filename.ts`'s `generateDocumentFilename()` (stripping
the `.md` it returns to use as the folder name) — the exact reuse
[docs/phases/phase-06.md](phases/phase-06.md) predicted: neither function needs to know or care
where the other's output ends up, and slug sanitization (including collapsing path-traversal-shaped
input like `../../etc/passwd` into ordinary hyphens) only has to be correct in one place.

`problems/index.json` is a small, structured index — `{ number, slug, title, difficulty,
pattern, complexity, status, path }` per problem — that exists purely to make rendering the root
README's table cheap and reliable, without needing to parse Markdown back out of every problem's
own README to reconstruct that data. It is not the source of truth for "does this problem
already exist" (the actual `problems/NNN-slug/README.md` file is — see
[Duplicate handling](#duplicate-handling) below); it's a rendering cache that's upserted
alongside every publish, so it can never drift for long.

**`patterns/` is deliberately not implemented.** The task says "do not overbuild pattern files
yet" — no code in this phase writes anything under `patterns/`. It's shown in the target layout
above only as a documented, reserved area for a future phase.

## Automatic README

`github/readmeTable.ts` renders the root README's problems table from the full
`problems/index.json`:

| # | Problem | Difficulty | Pattern | Complexity | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [Two Sum](problems/001-two-sum/README.md) | Easy | Hash Map | O(n) | Accepted |

— sorted by problem number, using `document/markdown/markdown.ts`'s `table()`/`tableCell()`
helpers (added in this phase, alongside the existing Phase 6 escaping primitives) so a pipe
character or newline inside a title can never break the table.

**"Do not destroy manually written sections. Use clear markers if automated content is
inserted."** The table is written between two HTML comment markers:

```markdown
<!-- codereviewai:problems-table:start -->

## Problems

| # | Problem | ... |
...

<!-- codereviewai:problems-table:end -->
```

`mergeProblemsTableIntoReadme(existingReadme, entries)` handles three cases:

1. **No README exists yet** — scaffolds a minimal default one (a title and one sentence) with
   the marked block appended.
2. **A README exists with the markers already present** — replaces only the content strictly
   between them, byte-for-byte preserving everything before and after (a hand-written intro,
   a hand-written outro, anything).
3. **A README exists with no markers yet** — appends the marked block after the existing
   content, on its own, rather than guessing where to insert it or overwriting anything.

`github-publish.service.test.ts` and `readmeTable.test.ts` both verify case 2 directly: a
hand-written intro and outro survive a publish untouched, byte-for-byte, while only the table
between the markers changes.

## Commit process

Every write goes through `github/commit.service.ts`'s `CommitService.buildMessage()` — the one
place commit-message text is decided, kept as pure string-building (like Phase 5's
`reviewPrompt.ts`), never inlined at a call site:

| Action | Example message |
| --- | --- |
| New problem | `docs: add analysis for Two Sum` |
| Re-analyzed problem | `docs: update analysis for Two Sum` |
| Index metadata | `docs: update problems index for Two Sum` |
| README table | `docs: update problems README index` |

This is the exact example the task gives (`"docs: add analysis for Two Sum"`), and there is no
code path anywhere in this system that can produce a generic message like `"update files"` —
`commit.service.test.ts` asserts this directly.

A single successful publish of a **new** problem produces **up to three commits** — the problem
document, `problems/index.json`, and `README.md` — each with its own message describing exactly
what changed, rather than one commit with a vague combined message. GitHub's Contents API
creates one commit per file write; there is no lower-level Git Data API tree/commit batching in
this MVP (see [Limitations](#limitations)).

**No commit is ever created for content that hasn't actually changed.** Before writing the
problem document, the index, or the README, `GitHubPublishService` compares the freshly rendered
content against what's already there (when something is already there) and skips the write
entirely if they're identical — so re-publishing a problem whose document didn't change (same
AI output, called again) produces zero commits, not an empty or redundant one.

## Duplicate handling

The task requires: detect whether a problem already exists, avoid accidental overwrite, and
define distinct behavior for creating vs. intentionally re-analyzing. `POST
/api/submissions/:id/publish` takes an optional `mode` in its request body (`"create"` | `"update"`,
default `"create"`) and `GitHubPublishService.publish()` enforces this contract explicitly:

| Existing file? | `mode` | Result |
| --- | --- | --- |
| No | `"create"` (or omitted) | Creates the file. Normal, first-time publish. |
| No | `"update"` | **Rejected** — `404 GITHUB_NOT_FOUND`: "nothing to update yet, use mode=create". |
| Yes | `"create"` (or omitted) | **Rejected** — `409 GITHUB_CONFLICT`: the exact "avoid accidental overwrite" case — nothing is written. |
| Yes | `"update"` | Updates the file (passing its current `sha`), *unless* the new content is byte-identical to what's already there, in which case the result is `"unchanged"` and nothing is written. |

Duplicate detection itself is a single `GET /repos/{owner}/{repo}/contents/{path}` call
(`file.service.ts`'s `findExisting()`) — the presence or absence of that file is the single
source of truth for "does this problem already exist," never inferred from `problems/index.json`
(which is only a rendering cache, as noted above). This means the check is correct even if the
index and the actual repository contents were ever to drift apart.

## Failure handling

Every failure mode maps to one of five `GitHubError` codes
(`AUTH_FAILED` | `NOT_FOUND` | `RATE_LIMITED` | `CONFLICT` | `API_ERROR`), translated to an
HTTP status by `controllers/githubErrorMapping.ts`'s `mapPublishErrorToApiError()` — the GitHub
counterpart to Phase 5's `aiErrorMapping.ts`:

| `GitHubError.code` | HTTP status | `error.code` | When |
| --- | --- | --- | --- |
| `AUTH_FAILED` | 502 | `GITHUB_AUTH_FAILED` | Missing/invalid token, or `GITHUB_REPO` malformed. |
| `NOT_FOUND` | 404 | `GITHUB_NOT_FOUND` | Repository doesn't exist/isn't visible to the token, or `mode="update"` with nothing to update. |
| `RATE_LIMITED` | 429 | `GITHUB_RATE_LIMITED` | GitHub returned HTTP 403 (rate limit or insufficient token scope). |
| `CONFLICT` | 409 | `GITHUB_CONFLICT` | `mode="create"` against an already-published problem, or GitHub itself reports a concurrent-modification conflict (HTTP 409). |
| `API_ERROR` | 502 | `GITHUB_API_ERROR` | Any other unexpected GitHub API failure. |

Publishing also runs the identical AI-review pipeline the review/document endpoints do (via the
shared `buildCombinedReview()`), so it can fail for any of *their* reasons too — a
`mapPublishErrorToApiError()` call that isn't a `GitHubError` falls through to Phase 5's
`mapAiErrorToApiError()` unchanged, so an AI timeout or malformed response is reported the exact
same way whether it happened during `/review`, `/document`, or `/publish`.

## Privacy and cost

Publishing sends nothing to GitHub beyond the rendered document, the small index entry, and the
rendered README table — no submission `id`, no internal metadata, nothing beyond what a human
would need to see in the published repository. Like the review and document endpoints, every
`/publish` call re-runs the AI review from scratch (no caching), so it costs exactly what
`/document` costs, plus up to three GitHub API writes.

## Limitations

- **Never exercised against the real GitHub API in this environment** — no GitHub token was
  available (or appropriate to use, given a real commit's permanence) here. Every test uses a
  mocked `GitHubClient` (`github/mockGitHubClient.ts`) or an injected mock `fetch`
  (`github-client.test.ts`), per the task's explicit "mock the GitHub API" requirement. This is
  the same category of honesty disclosure as Phase 5's initial Anthropic-provider disclosure —
  see [docs/phases/phase-07.md](phases/phase-07.md#verification).
- **Up to three separate commits per publish**, not one atomic commit — GitHub's simple Contents
  API (one file per call) was chosen over the lower-level Git Data API (which can build one
  commit spanning several file changes via a blob/tree/commit sequence) for MVP simplicity. A
  reader browsing the repository's commit history sees three adjacent, individually meaningful
  commits rather than one; they are not atomic as a group (a failure after the problem-document
  commit but before the index/README commits would leave them inconsistent until the next
  publish repairs them).
- **No retry logic** for a transient GitHub failure (rate limit, momentary 5xx) — it surfaces
  immediately as an error, the same posture Phase 5 takes for AI provider failures.
- **`patterns/` is unimplemented** — reserved in the documented repository layout, written by no
  code in this phase, per the task's explicit "do not overbuild" instruction.
- **No web/extension UI triggers a publish yet** — the endpoint exists, is fully tested, and
  works when called directly (e.g. via `curl`), matching Phase 5/6's "built, tested, not yet
  wired into a UI" posture.
- **The OAuth design above is a sketch, not an implementation** — no code in this phase
  implements it; it exists to show `GitHubAuthProvider`'s abstraction is sufficient for it later,
  per the task's "prepare an abstraction that can later support OAuth" requirement.
