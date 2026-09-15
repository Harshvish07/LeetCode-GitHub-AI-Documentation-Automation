# Phase 1 — Project Foundation

## Objective

Build the project foundation and establish a clean monorepo architecture for CodeReviewAI:
working (but minimal) frontend, backend, and Chrome extension skeletons, a shared TypeScript
types package, and full tooling (strict TypeScript, ESLint, Prettier, Vitest) — with no
LeetCode scraping, AI, GitHub integration, authentication, database, dashboard, or automatic
publishing. Those are explicitly out of scope for this phase.

## What Was Implemented

- An npm-workspaces monorepo with four packages: `apps/web`, `apps/api`, `apps/extension`,
  `packages/shared`.
- `apps/web`: a React + Vite + TypeScript app with one real page (`App.tsx`) that calls the
  backend's health endpoint and displays the result, proving frontend↔backend connectivity.
- `apps/api`: an Express + TypeScript backend with a single `GET /api/health` route, built as
  a testable app factory (`createApp`).
- `apps/extension`: a Chrome Extension (Manifest V3) skeleton — a background service worker
  and an action popup, both TypeScript, bundled with esbuild, requesting zero permissions.
- `packages/shared`: a TypeScript package exporting `ApiResponse<T>` / `HealthStatus` types
  and `success`/`failure`/`isSuccess` helper functions, consumed by both `apps/web` and
  `apps/api`.
- Root-level strict TypeScript config, a single flat ESLint config covering all four
  packages, Prettier, and Vitest test suites in every package (8 tests total, all passing).
- Full documentation: this file, plus `README.md`, `docs/project-overview.md`,
  `docs/architecture.md`, `docs/development.md`.

## Architecture

See [docs/architecture.md](../architecture.md) for the full diagrammed architecture. In one
sentence: `apps/web` (Vite dev server) calls `apps/api` (Express) at `/api/health`, both
import shared types from `packages/shared`, and `apps/extension` builds independently and has
no network calls yet.

## Folder Structure

```
/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── App.test.tsx
│   │   │   ├── main.tsx
│   │   │   ├── index.css
│   │   │   └── vite-env.d.ts
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── index.ts
│   │   │   └── routes/
│   │   │       ├── health.route.ts
│   │   │       ├── health.route.test.ts
│   │   │       └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   └── extension/
│       ├── src/
│       │   ├── background/service-worker.ts
│       │   ├── popup/popup.ts, popup.html, popup.css
│       │   └── lib/messaging.ts, messaging.test.ts
│       ├── scripts/build.mjs
│       ├── manifest.json
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/api.ts
│       │   ├── utils/apiResponse.ts, apiResponse.test.ts
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── tsconfig.build.json
│
├── docs/
│   ├── architecture.md
│   ├── development.md
│   ├── project-overview.md
│   └── phases/phase-01.md
│
├── .env.example
├── .gitignore
├── .prettierrc.json
├── .prettierignore
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## Files Created

### Root

- **`package.json`** — Purpose: declares the workspace list (`apps/*`, `packages/*`) and
  root-level dev tooling shared by every package (TypeScript, ESLint, Prettier, `concurrently`).
  Why it exists: npm workspaces requires a root `package.json` with a `workspaces` field; it's
  also the natural place for cross-package scripts (`dev`, `build`, `test`, `typecheck`,
  `lint`, `format`) so a contributor never needs to know which individual workspace command to
  run. What's implemented: a `postinstall` hook that builds `packages/shared` automatically
  after `npm install`, and `build`/`test`/`typecheck` scripts that explicitly build `shared`
  first (workspace script ordering isn't guaranteed by plain `npm run <script> --workspaces`).
  Used by: every `npm run <script>` invocation at the repo root. Future phases will add more
  scripts here as new workspaces or cross-cutting tasks appear.
- **`tsconfig.json`** — Purpose: the strict, shared base `compilerOptions` (`strict: true`,
  `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.) that every workspace's own
  `tsconfig.json` extends via `"extends": "../../tsconfig.json"`. Why: keeps strictness
  settings defined once instead of duplicated four times. Where used: extended by
  `apps/web/tsconfig.json`, `apps/api/tsconfig.json`, `apps/extension/tsconfig.json`,
  `packages/shared/tsconfig.json`.
- **`eslint.config.mjs`** — Purpose: a single ESLint 9+ flat config for the entire repo. Why:
  one config is simpler to maintain than four, and flat config natively supports per-glob
  overrides (React rules only for `apps/web/**`, `chrome.*`/browser globals only for
  `apps/extension/**`), so no duplication was needed. What's implemented: base JS + TypeScript
  recommended rules for everything, React Hooks/Refresh rules scoped to the web app, browser +
  WebExtension globals scoped to the extension, and `eslint-config-prettier` last to disable
  any formatting-related rule that would conflict with Prettier.
- **`.prettierrc.json` / `.prettierignore`** — Purpose: consistent formatting repo-wide.
  Markdown files are excluded from `.prettierignore` so hand-authored doc tables/diagrams
  aren't reflowed.
- **`.env.example`** — Purpose: documents every environment variable the project uses now
  (`PORT`, `NODE_ENV`, `CORS_ORIGIN`) or will use in a specific future phase
  (`AI_PROVIDER_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO` — all commented out and labeled with
  the phase that introduces them). No real secrets are committed. Used by: `apps/api/src/
  index.ts` reads `PORT` and `CORS_ORIGIN` via `process.env` (loaded through `dotenv/config`).
- **`.gitignore`** — Excludes `node_modules`, build output (`dist`, `*.tsbuildinfo`), `.env*`,
  logs, coverage, and packaged Chrome extension artifacts (`*.crx`, `*.pem`).

### `packages/shared`

- **`package.json`** — Purpose: declares `@codereviewai/shared` as an npm-workspace package
  with `main`/`types` pointing at compiled `dist/index.js` / `dist/index.d.ts`. Why compiled
  output rather than raw source: `apps/api` and `apps/web` resolve it through normal Node/Vite
  module resolution (not TypeScript `paths` aliasing), so `dist/` must exist and be valid
  JS/`.d.ts` — this is also what makes `npm run build -w @codereviewai/api` produce a runnable
  `node dist/index.js` without a TypeScript loader at runtime.
- **`tsconfig.json`** / **`tsconfig.build.json`** — `tsconfig.json` includes everything under
  `src` (including `*.test.ts`) and is used for `npm run typecheck`, so test files are
  type-checked too. `tsconfig.build.json` extends it and excludes `*.test.ts`, and is used only
  by `npm run build`, so test files never end up compiled into the published `dist/` output.
- **`src/types/api.ts`** — Purpose: the one response contract every API endpoint uses.
  Contains `ApiSuccess<T>` / `ApiError` / `ApiResponse<T>` (a discriminated union on
  `success`) and `HealthStatus` (the `GET /api/health` payload shape: `status`,
  `uptimeSeconds`, `timestamp`, `version`). Where used: `apps/api/src/routes/health.route.ts`
  constructs a `HealthStatus`; `apps/web/src/App.tsx` consumes it. What future phases will
  modify: new endpoint-specific payload types will be added alongside `HealthStatus` as new
  routes are built (e.g. a submission-capture payload in Phase 3).
- **`src/utils/apiResponse.ts`** — Purpose: three small pure functions — `success(data)`,
  `failure(message, code?)`, `isSuccess(response)` — so every package builds and narrows
  `ApiResponse` values the same way instead of hand-writing `{ success: true, data }` object
  literals everywhere. Where used: `apps/api/src/routes/health.route.ts` calls `success()`;
  covered by `apiResponse.test.ts`.
- **`src/utils/apiResponse.test.ts`** — 4 Vitest cases covering `success`, `failure`, and both
  branches of `isSuccess`'s type narrowing.
- **`src/index.ts`** — Purpose: the package's single public entry point, re-exporting the
  types and utilities above. Why: consumers (`apps/api`, `apps/web`) import everything from
  `@codereviewai/shared` rather than deep-importing internal files.

### `apps/api`

- **`package.json`** — Declares Express 5, `cors`, `dotenv` as runtime dependencies;
  `@types/*`, `supertest`, `tsx`, `typescript`, `vitest` as dev dependencies. Scripts: `dev`
  (`tsx watch`, auto-restarts on save), `build` (`tsc -p tsconfig.build.json`), `start`
  (`node dist/index.js` — runs the compiled production build), `typecheck`, `test`.
- **`tsconfig.json`** / **`tsconfig.build.json`** — Same split-config pattern as
  `packages/shared`, for the same reason: type-check test files, but never emit them.
- **`src/index.ts`** — Purpose: the process entry point. Loads `.env` via `dotenv/config`,
  reads `PORT` (default `4000`) and `CORS_ORIGIN` (default `http://localhost:5173`) from
  `process.env`, builds the app via `createApp()`, and calls `app.listen()`. Used by: `npm run
  dev` (via `tsx watch`) and `npm run start` (via compiled `dist/index.js`).
- **`src/app.ts`** — Purpose: `createApp(config: AppConfig): Express` — a factory function
  that wires up CORS, JSON body parsing, and mounts the API router at `/api`, **without**
  binding a port. Why a factory instead of module-level side effects: `health.route.test.ts`
  calls `createApp()` directly and passes the result to Supertest, so tests never need a real
  network port. Where used: `src/index.ts` (real server) and `src/routes/health.route.test.ts`
  (tests). Future phases will add more config fields (e.g. a database connection) to
  `AppConfig` as new dependencies are introduced.
- **`src/routes/health.route.ts`** — Purpose: implements `GET /api/health`, returning a
  `HealthStatus` (uptime, ISO timestamp, version) wrapped in `success(...)` from
  `@codereviewai/shared`. This is the first real proof that frontend, backend, and shared
  types are correctly wired together end to end.
- **`src/routes/health.route.test.ts`** — Purpose: a Supertest test asserting the endpoint
  returns HTTP 200 and a well-formed `HealthStatus` payload. Verifies the response shape
  matches the shared type at runtime, not just at compile time.
- **`src/routes/index.ts`** — Purpose: the aggregate router other route modules are mounted
  onto; currently mounts only `healthRouter`. Future phases will add new route files here
  (e.g. a submissions router in Phase 3) without changing `app.ts`.

### `apps/web`

- **`package.json`** — Declares React 19 + React DOM as runtime dependencies; Vite,
  `@vitejs/plugin-react`, `@types/react*`, `jsdom`, `@testing-library/react`, TypeScript,
  Vitest as dev dependencies. Scripts: `dev`, `build` (`tsc --noEmit` then `vite build`),
  `preview`, `typecheck`, `test`.
- **`vite.config.ts`** — Purpose: configures the React plugin, the dev-server proxy
  (`/api/* → http://localhost:4000`), and Vitest (`environment: 'jsdom'`, `globals: true`).
  Why the proxy matters: it means `apps/web/src/App.tsx` can call a relative `/api/health` URL
  with zero hardcoded backend host/port, in both dev and (with an equivalent reverse-proxy
  setup) production.
- **`index.html`** — Purpose: the Vite entry HTML, loading `src/main.tsx` as a module script.
- **`src/main.tsx`** — Purpose: mounts `<App />` into `#root` via React 19's `createRoot`,
  wrapped in `<StrictMode>`.
- **`src/App.tsx`** — Purpose: the only real UI in Phase 1. Renders the project name and
  tagline, then calls `GET /api/health` on mount and displays "checking..." / "online (uptime
  Ns)" / "offline (...)" depending on the result — a live, visible proof that the frontend and
  backend are connected. Where used: rendered by `main.tsx`; covered by `App.test.tsx`.
- **`src/App.test.tsx`** — Purpose: 2 React Testing Library tests — one asserts the title and
  tagline render, one stubs `global.fetch` and asserts the health status line updates once the
  (mocked) health check resolves.
- **`src/index.css`** — Minimal page styling (no CSS framework introduced in Phase 1).
- **`src/vite-env.d.ts`** — Standard Vite ambient type reference (`/// <reference
  types="vite/client" />`) so `import.meta.env` etc. type-check.

### `apps/extension`

- **`manifest.json`** — Purpose: the Manifest V3 declaration. Declares an `action` (popup)
  and a `background` service worker. Deliberately requests **zero** `permissions` and
  `host_permissions` — Phase 1 has no content script and reads no page data, so requesting any
  permission would violate least-privilege for no benefit. Future phase: Phase 2 will add
  `host_permissions: ["https://leetcode.com/*"]` and a `content_scripts` entry.
- **`scripts/build.mjs`** — Purpose: bundles `background.ts` and `popup.ts` with esbuild
  (`format: 'esm'`, `target: 'chrome110'`) into `dist/`, and copies `manifest.json`,
  `popup.html`, `popup.css` alongside the bundles. Why esbuild instead of Vite: an MV3
  background worker and popup script are two small, independent entry points with no shared
  dev-server/HMR need — a direct esbuild `context()`/`build()` call is simpler than configuring
  Vite for multi-entry, non-HTML-driven extension output. Supports `--watch` for local
  iteration (`npm run dev`).
- **`src/background/service-worker.ts`** — Purpose: a minimal MV3 service worker that logs a
  status message on install, proving the background-worker bundle loads and runs. Future
  phase: will receive messages from a content script and forward captured submissions to the
  API.
- **`src/popup/popup.html` / `popup.css` / `popup.ts`** — Purpose: a minimal action popup that
  displays a status string sourced from `lib/messaging.ts`, proving the popup bundle loads,
  runs, and can manipulate its own DOM.
- **`src/lib/messaging.ts`** — Purpose: currently a single placeholder function,
  `getExtensionStatusMessage()`, used by both the background worker and the popup so there's
  at least one piece of shared logic proven to bundle correctly into two separate esbuild
  entry points. Future phase: will become the real messaging layer connecting a content script
  to the background worker to the API.
- **`src/lib/messaging.test.ts`** — Purpose: a single Vitest case asserting the placeholder
  function returns a non-empty, on-brand string.

## Technologies Used

| Technology | Why selected | What it does | Where used |
| --- | --- | --- | --- |
| **React 19** | Current stable major; industry-standard component model. | Renders the web UI. | `apps/web` |
| **Vite** | Fast dev server, minimal config, native Vitest integration. | Dev server + production bundler for the web app. | `apps/web` |
| **Express 5** | Small, well-understood HTTP framework; current stable major. | HTTP routing/middleware for the API. | `apps/api` |
| **cors** | Standard, minimal middleware for controlled cross-origin access. | Restricts which origins may call the API. | `apps/api` |
| **dotenv** | Standard `.env` loading with zero config. | Loads `apps/api/.env` into `process.env` at startup. | `apps/api` |
| **tsx** | Runs TypeScript directly in Node with fast restart-on-save. | Powers `npm run dev` for the API. | `apps/api` |
| **esbuild** | Extremely fast bundler with a simple programmatic API; no dev-server overhead needed for a browser extension. | Bundles the extension's background/popup scripts. | `apps/extension` |
| **@types/chrome** | Type definitions for the `chrome.*` extension APIs. | Types `chrome.runtime.onInstalled` etc. | `apps/extension` |
| **TypeScript (strict)** | Catches an entire class of bugs at compile time; required by the project brief. | Compiles/typechecks every package. | everywhere |
| **npm workspaces** | Built into npm; no extra tool needed for this repo's current size. See the [package management decision](../../README.md#package-management-decision) in the README. | Manages the four-package monorepo. | root |
| **ESLint 9 (flat config) + typescript-eslint** | Current ESLint config format; strong TS-aware linting. | Lints the whole repo from one config. | root |
| **Prettier** | Deterministic formatting, zero bikeshedding. | Formats the whole repo. | root |
| **Vitest** | Vite-native test runner; fast; one tool for both Node and browser-environment tests. | Test runner in all four packages. | everywhere |
| **Supertest** | De facto standard for testing Express apps over HTTP without a real listening port. | Tests `GET /api/health`. | `apps/api` |
| **React Testing Library** | Tests components the way a user interacts with them, not implementation details. | Tests `App.tsx`. | `apps/web` |
| **concurrently** | Runs the web and API dev servers in one terminal with labeled, colored output. | Powers root `npm run dev`. | root |

## Commands

```bash
# Install (also builds packages/shared automatically)
npm install

# Run frontend + backend together
npm run dev

# Run tests (all workspaces)
npm run test

# Lint the whole repo
npm run lint

# Format the whole repo
npm run format

# Build everything (shared → api/web/extension)
npm run build

# Type-check everything
npm run typecheck
```

## Configuration

- **Root `tsconfig.json`**: shared strict compiler options (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`).
  Every workspace `tsconfig.json` extends this and adds its own `outDir`/`rootDir`/`lib`/
  module-resolution specifics.
- **`eslint.config.mjs`**: one flat config; see the "Root" section under Files Created above.
- **`apps/api/tsconfig.build.json`** and **`packages/shared/tsconfig.build.json`**: build-only
  configs that exclude `*.test.ts` from emitted output, while the main `tsconfig.json` in each
  package still includes tests for `npm run typecheck`.
- **`apps/web/vite.config.ts`**: dev-server proxy + Vitest config, described above.
- **`.env.example`**: documents `PORT`, `NODE_ENV`, `CORS_ORIGIN` (read today) and
  `AI_PROVIDER_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO` (placeholders for later phases, commented
  out, not read by any code).

## Testing

8 tests across 4 files, all passing:

- `packages/shared/src/utils/apiResponse.test.ts` (4 tests) — `success`/`failure`/`isSuccess`.
- `apps/api/src/routes/health.route.test.ts` (1 test) — `GET /api/health` returns 200 and a
  valid `HealthStatus` payload, via Supertest against `createApp()` directly.
- `apps/web/src/App.test.tsx` (2 tests) — title/tagline render; health status updates after a
  mocked `fetch` resolves.
- `apps/extension/src/lib/messaging.test.ts` (1 test) — the placeholder status message is
  non-empty and on-brand.

Run with `npm run test` (root) or `npm run test -w <package>` / `npm run test:watch -w
<package>` per package.

## Verification

Everything below was actually run against this repository as part of completing Phase 1 (not
just described):

1. `npm install` — succeeds, 0 vulnerabilities, `packages/shared/dist` produced automatically.
2. `npm run typecheck` — passes in all four workspaces (0 errors).
3. `npm run test` — 8/8 tests pass across all four workspaces.
4. `npm run lint` — 0 errors, 0 warnings.
5. `npm run format:check` — all files match Prettier style.
6. `npm run build` — `packages/shared`, `apps/api`, `apps/web`, `apps/extension` all build
   successfully; confirmed no `*.test.*` files leak into any `dist/` output.
7. `npm run start -w @codereviewai/api` (the **production** build, `node dist/index.js`, not
   the dev server) — started successfully; `curl http://localhost:4000/api/health` returned a
   valid `HealthStatus` JSON payload.
8. `npm run dev` (both dev servers together) — started successfully;
   `curl http://localhost:4000/api/health` (direct) and
   `curl http://localhost:5174/api/health` (through the Vite proxy) both returned the same
   valid payload, and `GET /` on the Vite dev server returned HTTP 200 — confirming the
   frontend↔backend connection works both directly and through the dev-server proxy.
9. All background dev/start processes were stopped after verification; no stray processes were
   left listening on ports 4000/5173/5174.

## Known Limitations

- The Chrome extension was verified to **build** correctly and pass its unit test, but was
  **not** loaded as an unpacked extension into an actual Chrome browser window as part of this
  verification pass — no browser automation was available in this environment. Loading
  `apps/extension/dist` via `chrome://extensions` → "Load unpacked" is a recommended manual
  check before relying on the extension further.
- No CI pipeline exists yet (no GitHub Actions workflow) — this repository has not been
  connected to a GitHub remote yet.
- The health endpoint, response envelope, and shared-types plumbing are the only "real"
  features. Everything else described in the README's roadmap is intentionally unbuilt.

## What Phase 2 Will Build

Per the roadmap in the README, Phase 2 will extend `apps/extension` to read problem and
submission data directly from the LeetCode DOM — the first piece of actual LeetCode-specific
logic, building on the popup/background-worker skeleton and `messaging.ts` placeholder
established here. It will introduce `host_permissions` scoped to `leetcode.com`, a
`content_scripts` entry in `manifest.json`, and the first domain types (e.g. a LeetCode
problem/submission shape) in `packages/shared`.
