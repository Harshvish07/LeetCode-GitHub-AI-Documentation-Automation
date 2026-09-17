# Development Guide

## Prerequisites

- **Node.js ≥ 20** (this project was developed and verified against Node 24.11.0). Check with
  `node --version`.
- **npm ≥ 10** (ships with modern Node installs). Check with `npm --version`.
- No database, Docker, or other services are required — everything runs with plain `node`/`npm`
  (submissions are stored in-memory by the API process; see
  [docs/phases/phase-03.md](phases/phase-03.md#limitations)).
- An AI provider API key (`AI_PROVIDER_API_KEY` — Anthropic or Gemini, selected by
  `AI_PROVIDER`) is needed **only** to actually call `POST /api/submissions/:id/review`,
  `POST /api/submissions/:id/document`, or `POST /api/submissions/:id/publish` — every other
  command, endpoint, and test in this guide works with no key configured at all. See
  [docs/ai-analysis.md](ai-analysis.md) and [docs/document-generation.md](document-generation.md).
- A GitHub personal access token (`GITHUB_TOKEN`) and a target repository (`GITHUB_REPO`, as
  `"owner/repo"`) are needed **only** to actually call `POST /api/submissions/:id/publish` —
  every other command, endpoint, and test works with no GitHub configuration at all. See
  [docs/github-integration.md](github-integration.md).

## Installation

From the repository root:

```bash
npm install
```

This single command:

1. Installs dependencies for every workspace (`apps/web`, `apps/api`, `apps/extension`,
   `packages/shared`, `packages/analysis`) into a single root-level `node_modules`,
   deduplicated by npm workspaces.
2. Automatically runs `packages/shared`'s and `packages/analysis`'s builds (`tsc`) via a root
   `postinstall` script (`build:packages`), so their `dist/` output exists immediately — this
   matters because `apps/api` resolves both `@codereviewai/shared` and `@codereviewai/analysis`
   as normal npm dependencies, pointing at compiled `dist/` output, not raw TypeScript source.

If you ever delete `packages/shared/dist` or `packages/analysis/dist` manually, running
`npm run build:packages` (or any of `npm run build` / `npm run test` / `npm run typecheck` from
the root, which all rebuild both as a first step) restores them.

## Commands

All commands below are run from the **repository root** unless noted otherwise.

| Command | What it does |
| --- | --- |
| `npm install` | Install all workspace dependencies; builds `packages/shared` and `packages/analysis`. |
| `npm run dev` | Runs `apps/web` (Vite, port 5173) and `apps/api` (tsx watch, port 4000) together via `concurrently`. |
| `npm run dev:web` | Runs only the frontend dev server. |
| `npm run dev:api` | Runs only the backend dev server (auto-restarts on file changes via `tsx watch`). |
| `npm run build` | Builds `packages/shared` and `packages/analysis` first, then `apps/api`, `apps/web`, and `apps/extension`. |
| `npm run test` | Rebuilds `packages/shared`/`packages/analysis`, then runs every workspace's Vitest suite once. |
| `npm run typecheck` | Rebuilds `packages/shared`/`packages/analysis`, then runs `tsc --noEmit` in every workspace. |
| `npm run lint` | Runs ESLint across the entire repo from one root flat config. |
| `npm run lint:fix` | Same, with `--fix`. |
| `npm run format` | Runs Prettier `--write` across the repo. |
| `npm run format:check` | Runs Prettier `--check` (fails if anything is unformatted). |

Per-workspace equivalents exist too, e.g. `npm run test -w @codereviewai/api` or
`npm run dev -w @codereviewai/web` (or `cd apps/api && npm run test`).

## Development workflow

1. `npm install` once after cloning.
2. `npm run dev` to start the frontend and backend together. The frontend is at
   `http://localhost:5173` (Vite will pick the next free port, e.g. `5174`, if 5173 is
   occupied — check the terminal output) and shows a live "Backend status" line proving the
   two processes are connected. The backend is at `http://localhost:4000`.
3. Edit `apps/api/src/**` — `tsx watch` restarts the server automatically.
4. Edit `apps/web/src/**` — Vite hot-reloads the browser automatically.
5. Edit `packages/shared/src/**` or `packages/analysis/src/**` — run `npm run build:packages`
   (or restart `npm run dev`) to pick up the change in `apps/api`/`apps/web`, since they
   consume both packages' **compiled** output, not their live source. (Each package's own
   tests via `npm run test:watch -w @codereviewai/shared` / `-w @codereviewai/analysis` run
   against source directly, so no rebuild is needed just to test that package in isolation.)
6. For the extension: `npm run build -w @codereviewai/extension`, then in Chrome go to
   `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select
   `apps/extension/dist`. Re-run the build after changes and click the refresh icon on the
   extension card (there is no watch-and-auto-reload wiring for the browser itself in Phase 1;
   `npm run dev -w @codereviewai/extension` does run esbuild in watch mode and rewrites
   `dist/` on save, but Chrome itself still needs a manual reload of the unpacked extension).

## Testing workflow

```bash
npm run test                         # every workspace, once
npm run test:watch -w @codereviewai/api      # one workspace, watch mode
```

- `apps/api` tests use **Supertest** against the Express app built by `createApp()` — no real
  port is bound, so tests are fast and don't conflict with a `npm run dev:api` instance
  running on the same machine. `POST /api/submissions` is covered at every layer: schema rules
  (`schemas/submission.schema.test.ts`), service normalization
  (`services/submissions.service.test.ts`), repository round-trips
  (`repositories/submissions.repository.test.ts`), and full HTTP-level integration
  (`routes/submissions.route.test.ts`). `POST /api/submissions/:id/review` (Phase 5) is covered
  the same way, plus the whole `ai/` module in isolation (prompt building, schema validation,
  provider request/response mapping, the orchestrating service, and the deterministic-vs-AI
  agreement comparison) — **every AI-facing test uses a mocked provider
  (`ai/providers/mockProvider.ts`) or a mocked `fetch`; nothing ever calls a real AI API.**
  `POST /api/submissions/:id/document` (Phase 6) reuses the same mocked-provider discipline,
  plus the whole `document/` module in isolation (Markdown-primitive escaping/fencing, filename
  sanitization, and full document generation — required sections, exact code preservation,
  special-character handling, and missing-field fallbacks). `POST /api/submissions/:id/publish`
  (Phase 7) reuses both, plus the whole `github/` module in isolation (repository lookup, file
  create/update, duplicate detection, commit-message generation, and every GitHub API failure
  mode) — **every GitHub-facing test uses a mocked `GitHubClient`
  (`github/mockGitHubClient.ts`) or an injected mock `fetch`; nothing ever calls the real GitHub
  API.**
- `apps/web` tests use **React Testing Library** with Vitest's `jsdom` environment; `fetch` is
  stubbed per-test with `vi.stubGlobal` so no real network call happens.
- `apps/extension` tests use `jsdom`'s `JSDOM` class directly for DOM-dependent extraction
  logic, and a stubbed `fetch` (like `apps/web`) for `lib/api.test.ts`, which exercises the
  extension's `POST /api/submissions` client without a real network call.
- `packages/shared` and `packages/analysis` tests are plain Vitest unit tests of pure
  functions — no network, no DOM (aside from `packages/analysis`'s own text-based heuristics,
  which never touch a real page).

## Linting

```bash
npm run lint
```

One flat ESLint config (`eslint.config.mjs`) at the repo root covers every workspace:
TypeScript rules everywhere, React-specific rules (`react-hooks`, `react-refresh`) scoped to
`apps/web/**`, and browser/`chrome.*` globals scoped to `apps/extension/**`. There is no
per-workspace ESLint config to keep in sync.

## Formatting

```bash
npm run format          # apply
npm run format:check     # verify only, no changes (used before considering work "done")
```

Prettier config is in `.prettierrc.json`; `.prettierignore` excludes `node_modules`, build
output, `package-lock.json`, and Markdown files (Markdown is excluded so hand-formatted docs
tables and Mermaid diagrams aren't reflowed).

## Building

```bash
npm run build
```

Produces:

- `packages/shared/dist` — compiled JS + `.d.ts` declarations.
- `packages/analysis/dist` — compiled JS + `.d.ts` declarations for the deterministic analysis
  engine (Phase 4).
- `apps/api/dist` — compiled JS (via `tsc -p tsconfig.build.json`, which excludes `*.test.ts`
  files, as well as `src/ai/providers/mockProvider.ts` and `src/github/mockGitHubClient.ts` —
  test/dev-only fakes that must never ship — so none of them end up in the shipped output).
- `apps/web/dist` — static production build (`tsc --noEmit` for a final type-check, then
  `vite build`).
- `apps/extension/dist` — bundled `background.js`, `popup/popup.js`, `content/leetcode.js`,
  plus copied `manifest.json`, `popup.html`, `popup.css`.

To run the built API standalone: `npm run start -w @codereviewai/api` (runs
`node dist/index.js`).

## Troubleshooting

- **`Cannot find module '@codereviewai/shared'` or `'@codereviewai/analysis'`** —
  `packages/shared/dist` or `packages/analysis/dist` is missing or stale. Run
  `npm run build:packages` from the root (builds both).
- **`POST /api/submissions/:id/review`, `.../document`, or `.../publish` returns
  `502 AI_PROVIDER_ERROR`** — most likely `AI_PROVIDER_API_KEY` isn't set in your environment
  (all three endpoints share the same underlying AI call, via `buildCombinedReview()`). This is
  expected in local dev without a key; every other endpoint works normally. See
  [docs/ai-analysis.md](ai-analysis.md), [docs/document-generation.md](document-generation.md),
  and [docs/api.md](api.md#post-apisubmissionsidreview).
- **`POST /api/submissions/:id/publish` returns `502 GITHUB_AUTH_FAILED`** — most likely
  `GITHUB_TOKEN` or `GITHUB_REPO` isn't set (or `GITHUB_REPO` isn't in `"owner/repo"` form) in
  your environment. This is expected in local dev without GitHub configured; every other
  endpoint, including `/review` and `/document`, works normally. See
  [docs/github-integration.md](github-integration.md) and
  [docs/api.md](api.md#post-apisubmissionsidpublish).
- **`tsc` reports `rootDir` errors mentioning files in `packages/shared/src`** — this means a
  workspace's `tsconfig.json` is trying to type-check shared's raw source instead of resolving
  it as a compiled package; don't add a `paths` override pointing at `packages/shared/src` in
  an app's `tsconfig.json` — resolution is intentionally left to go through the compiled
  `dist/` package like any other npm dependency.
- **Vite dev server says "Port 5173 is in use, trying another one..."** — a previous `npm run
  dev` process is still running (or its terminal was closed without stopping it). Check the
  actual port Vite reports and use that, or stop the stray process first.
- **`npm install` warns about an unsupported engine** — check `node --version` against the
  `engines` field in the root `package.json`; some transitive dev dependencies (e.g. `jsdom`)
  pin fairly recent minimum Node versions.
- **Chrome extension doesn't reflect a code change** — rebuild
  (`npm run build -w @codereviewai/extension`) and click the reload icon for the extension on
  `chrome://extensions` — Chrome does not hot-reload unpacked extensions automatically.
- **"Submit Solution" in the popup says it can't reach the API** — the API isn't running.
  Start it with `npm run dev:api` (or `npm run start -w @codereviewai/api` for the production
  build) — the extension calls `http://localhost:4000` directly, independent of whether
  `apps/web`'s dev server is running.
- **"Submit Solution" fails after reloading the extension with a new `manifest.json`** — a
  changed `host_permissions` entry requires reloading the unpacked extension on
  `chrome://extensions` (not just rebuilding it) for Chrome to re-prompt for/apply the new
  permission.
