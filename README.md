# CodeReviewAI — AI-Powered LeetCode Solution Analyzer

> **Status: Phase 9 of 10 — Improvement Tracking.** Every problem now keeps its full
> attempt history (failed → improved → accepted) with a comparison of what changed between
> attempts, a **personal learning profile** of recurring weaknesses, and a **recommendation
> engine** — all derived from stored data only, never invented, and shown on the problem detail
> page and a new **Learning** page. Generated documents optionally gain `## Submission History`,
> `## How My Solution Improved`, and `## Recurring Mistakes` sections. See
> [docs/improvement-engine.md](docs/improvement-engine.md) and
> [docs/phases/phase-09.md](docs/phases/phase-09.md).
>
> **Phase 8 — Dashboard & Learning Analytics.** A web dashboard
> (`apps/web`) shows your DSA learning progress — total/accepted/optimal/needs-improvement
> counts, streaks, difficulty distribution, per-pattern analytics for 16 patterns, a
> searchable/filterable/sortable problem list, and a per-problem detail view (your code, static
> analysis, AI review, better approach, learning points, GitHub link) — backed by a new optional
> **PostgreSQL** persistence layer with migrations. See [Phase Status](#21-phase-status),
> [docs/phases/phase-08.md](docs/phases/phase-08.md), and [docs/database.md](docs/database.md)
> for exactly what is implemented today. Earlier phases: Phase 7 (GitHub publishing):
> [docs/phases/phase-07.md](docs/phases/phase-07.md) /
> [docs/github-integration.md](docs/github-integration.md); (Phase 1: [docs/phases/phase-01.md](docs/phases/phase-01.md), Phase 2:
> [docs/phases/phase-02.md](docs/phases/phase-02.md), Phase 3:
> [docs/phases/phase-03.md](docs/phases/phase-03.md), Phase 4:
> [docs/phases/phase-04.md](docs/phases/phase-04.md), Phase 5:
> [docs/phases/phase-05.md](docs/phases/phase-05.md) /
> [docs/ai-analysis.md](docs/ai-analysis.md), Phase 6:
> [docs/phases/phase-06.md](docs/phases/phase-06.md) /
> [docs/document-generation.md](docs/document-generation.md)).

## 1. What this project does

CodeReviewAI turns a LeetCode submission into a structured learning artifact. The intended
end-to-end flow (built incrementally across later phases) is:

1. You solve a problem on LeetCode and submit your solution.
2. A Chrome extension captures the problem metadata and your submitted code.
3. The captured data is sent to a backend API.
4. An AI layer analyzes the solution: it identifies the DSA pattern/technique used, explains
   why the solution works, evaluates time and space complexity, points out weaknesses, suggests
   improvements, and compares the solution against a more optimal approach.
5. The analysis is rendered into a Markdown "learning document."
6. That document is automatically committed to a GitHub repository, building a personal,
   versioned log of solved problems and what was learned from each one.

## 2. Problem this project solves

Solving LeetCode problems in isolation rarely produces durable learning. Once a submission is
accepted, most people move on without recording *why* the solution worked, what pattern it
used, or how it compares to the optimal approach — so the same gaps resurface in later
problems and in interviews. CodeReviewAI closes that loop automatically: every accepted
submission becomes a reviewed, explained, and permanently recorded learning artifact with
zero manual write-up effort.

## 3. Target users

- Developers preparing for technical interviews who want a structured, cumulative record of
  what they've practiced and learned.
- Self-taught or CS-adjacent engineers building DSA pattern recognition over time.
- Anyone who wants a public (or private) GitHub log of their problem-solving growth without
  manually writing notes after every submission.

## 4. Main features planned (across all 10 phases)

- Chrome extension that captures LeetCode problem + submission data (Phase 2–3)
- Backend API to receive and store submission payloads (Phase 3)
- Deterministic (non-AI) pattern detection, complexity estimation, code-quality and edge-case
  analysis (Phase 4)
- AI-powered solution review layered on top of Phase 4's deterministic findings, answering 16
  required review questions with disagreement between the AI and static analysis explicitly
  surfaced (Phase 5)
- Automatic generation of a structured, professional Markdown learning document per submission
  (Phase 6)
- Automatic commit of that document to a GitHub repository via the GitHub API, with duplicate
  detection and structured commits (Phase 7)
- A web dashboard to browse past submissions and generated documents, with pattern analytics,
  backed by a PostgreSQL persistence layer with migrations (Phase 8)
- Per-problem attempt history, attempt-to-attempt comparison, a learning profile of recurring
  weaknesses, and evidence-backed practice/review recommendations (Phase 9)
- Polish and hardening (Phase 10)

## 5. Current implementation status

**Phases 1–9.** What exists right now:

- The **improvement engine** (Phase 9), `apps/api/src/analytics/` plus
  `services/improvement.service.ts`: pure functions that turn stored submissions into an
  attempt history, attempt-to-attempt comparisons (status, complexity, patterns, bug fixes,
  quality, a line diff), a learning profile, and recommendations, exposed by four read endpoints
  (`GET /api/problems/:id/history`, `/api/problems/:id/compare`, `/api/learning/profile`,
  `/api/learning/recommendations`). Every statement carries its "N of M" evidence, and history
  needs **no new migration** — attempts are the `submissions` rows that already existed. See
  [docs/improvement-engine.md](docs/improvement-engine.md).

- A working npm-workspaces monorepo with five packages (`apps/web`, `apps/api`,
  `apps/extension`, `packages/shared`, `packages/analysis`).
- A React + Vite frontend (Phase 8, extended in Phase 9): a four-page dashboard — Dashboard,
  Problems, Problem detail (now with a submission-history section), and Learning (profile and
  recommendations) — built from small reusable components (`apps/web/src/components/`), with hash routing,
  a typed API client, and a light/dark theme. See [The dashboard](#the-dashboard) below.
- An Express + TypeScript backend with `GET /api/health` and (Phase 3) `POST /api/submissions`
  — layered routes → validation middleware → controllers → services → repositories, with a
  Zod schema that is the real runtime source of truth for what the server accepts, a
  normalizing/id-assigning service, an in-memory repository behind a swappable interface, and
  centralized error handling with a consistent JSON envelope for every failure. Full reference:
  [docs/api.md](docs/api.md).
- A Chrome Extension (Manifest V3) with a content script that runs on LeetCode problem pages
  and extracts problem/submission data (title, slug, number, difficulty, description,
  language, submitted code, submission status, runtime, memory) via a dedicated, modular
  LeetCode adapter (`apps/extension/src/content/leetcode/`) — every field falls back to `null`
  ("Unavailable" in the UI) rather than guessing when it can't be found reliably.
- A popup UI with **Extract Problem** (friendly summary), **Analyze Solution** (raw JSON debug
  view — no AI call yet), and (Phase 3) **Submit Solution** (POSTs the extraction to the API,
  showing loading/success/validation-error/failure states).
- A shared TypeScript package with a common API response envelope, health-check types, the
  `LeetCodeExtraction` domain type, and (Phase 3) the `POST /api/submissions` wire contract
  (`CreateSubmissionRequest`/`StoredSubmission`) plus the LeetCode URL-parsing logic, shared
  between the extension and the API so both validate a problem URL the same way.
- A deterministic analysis engine, `packages/analysis` (Phase 4):
  `analyzeSolution({ code, language })` recognizes 19 algorithm patterns (Hash Map, Two
  Pointers, DFS, Dynamic Programming, ...) via a modular, confidence-scored signal engine;
  estimates time/space complexity from loop nesting, recursion, and the detected patterns; and
  flags code-quality and edge-case concerns — every output carrying its own confidence level
  and, for patterns, plain-language evidence. As of Phase 5, a real dependency of `apps/api`.
  See [docs/phases/phase-04.md](docs/phases/phase-04.md).
- An AI-powered review layer, `apps/api/src/ai/` (Phase 5): `POST
  /api/submissions/:id/review` runs Phase 4's deterministic analysis, sends the problem +
  code + that analysis to an LLM provider (Anthropic Claude or Google Gemini, selected by
  `AI_PROVIDER` behind a swappable `AiProvider` interface), validates the response against a
  strict Zod schema, and returns
  **both** analyses side by side plus an explicit `agreement` comparison — never merging them
  or hiding a disagreement. Every AI failure mode (timeout, provider error, rate limit,
  malformed/invalid response) maps to a specific HTTP status. See
  [docs/ai-analysis.md](docs/ai-analysis.md) and [docs/phases/phase-05.md](docs/phases/phase-05.md).
- A document generation layer, `apps/api/src/document/` (Phase 6): `POST
  /api/submissions/:id/document` turns the same problem/code/deterministic-analysis/AI-review
  data into a complete, 18-section Markdown learning document — the exact submitted code,
  unmodified and labeled **YOUR SOLUTION**; both analyses' patterns/complexity shown side by
  side with an explicit agreement note; a clearly-labeled **RECOMMENDED SOLUTION** (with
  pseudocode and working code) when a better approach exists, or an explicit "already optimal"
  statement when it doesn't. A dedicated `markdown/` primitives module escapes every piece of
  dynamic text so AI-generated or extracted prose can never inject rogue document structure,
  while leaving actual code completely untouched. See
  [docs/document-generation.md](docs/document-generation.md) and
  [docs/phases/phase-06.md](docs/phases/phase-06.md).
- A GitHub publishing layer, `apps/api/src/github/` (Phase 7): `POST
  /api/submissions/:id/publish` commits that same document to a configured GitHub repository —
  `problems/NNN-slug/README.md`, a structured `problems/index.json`, and an auto-maintained root
  `README.md` table (inserted between clear HTML-comment markers so hand-written content is
  never touched). Wraps `@octokit/rest` behind a swappable `GitHubClient` interface (mirroring
  the AI provider abstraction); a request explicitly states `mode: "create"` or `"update"`, and
  publishing a problem that already exists in `"create"` mode is **rejected**, never silently
  overwritten. Every write gets a specific, meaningful commit message (e.g. `"docs: add
  analysis for Two Sum"`) — never a generic one. Token-based auth only for now
  (`GITHUB_TOKEN`), behind an abstraction ready for OAuth later. See
  [docs/github-integration.md](docs/github-integration.md) and
  [docs/phases/phase-07.md](docs/phases/phase-07.md).
- A persistence layer, `apps/api/src/persistence/` (Phase 8): PostgreSQL behind a small
  `Database` interface (the only file importing `pg` is `pgDatabase.ts`), a versioned migration
  runner, and six tables — `users`, `problems`, `submissions`, `analyses`, `reviews`,
  `documents`. **Optional:** with no `DATABASE_URL` the API runs exactly as before (in-memory
  submissions) and the dashboard endpoints answer `503`. Review, document, and publish requests
  now also *record* their results (best-effort) for the dashboard. See
  [docs/database.md](docs/database.md).
- An analytics layer, `apps/api/src/analytics/` (Phase 8): pure, database-free functions for the
  0-100 **quality score**, UTC-day **streaks**, **pattern normalization** onto 16 tracked
  patterns, and every dashboard statistic — plus four read endpoints (`GET /api/dashboard/summary`,
  `/api/dashboard/patterns`, `/api/problems`, `/api/problems/:id`). See
  [docs/api.md](docs/api.md#dashboard-endpoints) and [docs/phases/phase-08.md](docs/phases/phase-08.md).
- Strict TypeScript, ESLint (flat config), Prettier, and Vitest configured and passing across
  every package — 730 tests total (476 API — 67 new in Phase 9, 41 extension, 102 web — 7 new,
  38 shared — 5 new, 73 analysis). No test anywhere ever makes a real AI or GitHub API call — every such
  test uses a mocked provider/client — and the database tests run real Postgres SQL in-process
  via PGlite, with no server.

Nothing beyond this exists yet. There is no authentication or multi-user support (everything
belongs to one built-in local user), no OAuth (GitHub publishing uses a single token only), and
no web/extension UI *triggers* a review, document, or publish — the dashboard displays what those
endpoints recorded, and they are still called via `curl`. The dashboard UI has not been seen in a
real browser, and no stock PostgreSQL server was available to test against — see
[Known Limitations](#27-known-limitations).

## 6. Architecture overview

```mermaid
flowchart LR
    LC[LeetCode problem page] -- content script reads DOM --> EXT
    subgraph Browser
        EXT[Chrome Extension<br/>apps/extension]
    end
    WEB[React Dashboard<br/>apps/web] -- "HTTP: /api/dashboard/*, /api/problems*" --> API[Express API<br/>apps/api]
    API -- "SQL via pg (optional)" --> DB[(PostgreSQL)]
    EXT -- "POST /api/submissions<br/>(host_permissions bypasses CORS)" --> API
    API -- imports types --> SHARED[Shared Types<br/>packages/shared]
    WEB -- imports types --> SHARED
    EXT -- imports types --> SHARED
    ANALYSIS[Analysis Engine<br/>packages/analysis]
    API -- "analyzeSolution()" --> ANALYSIS
    API -- "server-side only" --> AI[Anthropic or Gemini API<br/>via ai/providers/createProviderFromEnv.ts]
    API -- "server-side only" --> GH[GitHub API<br/>via github/github-client.ts]
    API -. future phase (OAuth) .-> OAUTH[GitHub OAuth]
```

Implemented today: the web dashboard (Phase 8) reads the API's dashboard endpoints (proxied
through Vite in development), which read from PostgreSQL when `DATABASE_URL` is set; the extension's content script reads a LeetCode problem page's DOM and returns
structured data to the popup on request; the popup can POST that data to
`POST /api/submissions`, which validates, normalizes, and stores it; all three apps share type
definitions from `packages/shared`; the deterministic analysis engine (`packages/analysis`,
Phase 4) is now a real dependency of `apps/api`; `POST /api/submissions/:id/review` (Phase 5)
combines that deterministic analysis with a schema-validated AI review, calling the configured
provider's API (Anthropic or Gemini, per `AI_PROVIDER`) server-side only;
`POST /api/submissions/:id/document` (Phase 6) turns that same combined review into a Markdown
document, reusing the identical `ANALYSIS`/`AI` connections shown above (see
`services/combined-review.service.ts`) rather than adding a new external dependency; and
`POST /api/submissions/:id/publish` (Phase 7) commits that document to the configured GitHub
repository, server-side only, via a token read from `GITHUB_TOKEN`. The dotted arrow is a
future-phase connection (OAuth-based GitHub auth, replacing the single token), described for
context in [docs/architecture.md](docs/architecture.md).

## 7. Technology stack

| Area       | Technology                                   | Why                                                                                          |
| ---------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite (hash routing, plain CSS — no router or UI library) | Fast dev server and a dashboard small enough that a router/chart/UI dependency would cost more than it saves. |
| Backend    | Node.js, Express 5, TypeScript, Zod           | Small, well-understood HTTP framework; Zod gives runtime schema validation that doesn't just trust a client-side TypeScript type. |
| Extension  | Chrome Extension Manifest V3, TypeScript, esbuild | MV3 is the current Chrome extension standard; esbuild gives fast, dependency-light bundling.   |
| Shared     | TypeScript project (`packages/shared`)       | Single source of truth for types/contracts shared across web, api, and extension.              |
| Analysis   | TypeScript project (`packages/analysis`), no runtime dependencies | Deterministic pattern/complexity/quality/edge-case heuristics, kept dependency-free and standalone so it's trivially testable and reusable from any future consumer. |
| AI         | Anthropic Claude (Messages API) or Google Gemini (`generateContent` API), selected by `AI_PROVIDER` via a swappable `AiProvider` interface | A structured, schema-validated review layered on Phase 4's deterministic findings; the provider abstraction means a different LLM vendor is a new file, not a rewrite. |
| GitHub     | `@octokit/rest` behind a swappable `GitHubClient` interface | Official GitHub REST API client; the abstraction (mirroring `AiProvider`) means auth can move from a single token to OAuth later without touching request logic. |
| Database   | PostgreSQL via `pg`, behind a swappable `Database` interface; SQL migrations written as TypeScript modules | Relational data with real constraints and a latest-per-problem query; the interface keeps `pg` in one file, and tests run real Postgres SQL in-process with PGlite (no server). |
| Testing    | Vitest, Supertest, React Testing Library, PGlite | Fast, Vite-native test runner; Supertest for HTTP assertions; RTL for component behavior.       |
| Code quality | ESLint (flat config) + typescript-eslint, Prettier | Consistent style and catch common bugs across a multi-package repo from one root config.  |
| Tooling    | npm workspaces                                | See [Package management decision](#package-management-decision) below.                         |

### Package management decision

This project uses **npm workspaces** rather than a separate monorepo tool (Turborepo, Nx,
pnpm+Lerna, etc.). Reasoning:

- npm workspaces ship with npm itself (no extra global tool to install or version).
- Phase 1's dependency graph is small and shallow (`api`, `web`, and `extension` each depend
  only on `shared`) — there's no need for a task-graph orchestrator or remote build cache yet.
- A single lockfile and `node_modules` tree keeps dependency versions consistent across
  packages without extra configuration.
- If build orchestration complexity grows in later phases (e.g. many interdependent
  packages, slow CI), Turborepo or Nx can be layered on top of the existing workspace
  structure without restructuring the repo.

## 8. Repository structure

```
/
├── apps/
│   ├── web/            React + Vite dashboard (Phase 8)
│   │       └── src/
│   │           ├── pages/              DashboardPage, ProblemsPage, ProblemDetailPage, LearningPage
│   │           ├── components/          common/ dashboard/ problems/ detail/ improvement/ layout/
│   │           ├── api/  hooks/  router/   Typed API client, useAsync, hash routing
│   │           └── App.tsx               Header + route switch
│   ├── api/             Express + TypeScript backend
│   │       └── src/
│   │           ├── routes/          POST /api/submissions(/:id/review, /:id/document, /:id/publish), GET /api/dashboard/*, GET /api/problems(/:id), GET /api/problems/:id/(history|compare), GET /api/learning/(profile|recommendations), GET /api/health
│   │           ├── controllers/      Thin HTTP handlers + shared error mapping (aiErrorMapping.ts, githubErrorMapping.ts)
│   │           ├── services/          Business logic (normalize, assign id, persist,
│   │           │                      buildCombinedReview() + GitHubPublishService shared by all three endpoints)
│   │           ├── schemas/            Zod validation (the real runtime contract)
│   │           ├── repositories/        SubmissionRepository interface + in-memory implementation
│   │           ├── middleware/           validateBody, errorHandler, requestLogger
│   │           ├── types/                 ApiError/ValidationError/NotFoundError
│   │           ├── ai/                     AI review layer (Phase 5 — see below)
│   │           │   ├── prompts/               System/user prompt construction
│   │           │   ├── providers/              AiProvider interface + Anthropic/Gemini implementations
│   │           │   ├── schemas/                  Zod schema for the AI's structured output
│   │           │   └── ai-review.service.ts        Orchestrator: prompt → provider → validate
│   │           ├── document/                Document generation layer (Phase 6 — see below)
│   │           │   ├── markdown/               Markdown primitives (escapeMarkdown, codeBlock, table, ...)
│   │           │   ├── templates/               One file per document section group
│   │           │   ├── formatter/                Safe filename generation
│   │           │   └── document-generator.ts       The one exported entry point
│   │           ├── persistence/             PostgreSQL layer (Phase 8 — see docs/database.md)
│   │           │   ├── database.ts / pgDatabase.ts   Database interface + the one `pg` implementation
│   │           │   ├── migrate.ts / migrations/       Versioned schema + runner
│   │           │   └── postgres*Repository.ts          Submission + learning (dashboard) repositories
│   │           ├── analytics/                Quality score, streaks, pattern normalization, statistics (Phase 8);
│   │           │                             attempts, comparison, learning profile, recommendations (Phase 9)
│   │           └── github/                  GitHub publishing layer (Phase 7 — see below)
│   │               ├── github-client.ts        GitHubClient interface + the one Octokit implementation
│   │               ├── repository.service.ts    Repository lookup
│   │               ├── file.service.ts           Duplicate detection + create/update
│   │               ├── commit.service.ts          Meaningful commit-message construction
│   │               └── readmeTable.ts              Auto-maintained root README table
│   └── extension/        Chrome Extension (Manifest V3)
│       └── src/
│           ├── content/leetcode/   LeetCode extraction adapter (parser, selectors,
│           │                       extractor, url, types — see docs/phases/phase-02.md)
│           ├── popup/               Extension popup UI
│           ├── background/          Background service worker
│           └── lib/                 Messaging contract + API client (lib/api.ts)
│
├── packages/
│   ├── shared/          Shared TypeScript types and small utilities
│   └── analysis/         Deterministic solution-analysis engine (Phase 4)
│       └── src/
│           ├── pattern-detector/    19 algorithm patterns, signal-based rule engine
│           ├── complexity-analyzer/  Time/space complexity heuristics
│           ├── code-review/           Style/maintainability observations
│           ├── edge-case-analyzer/     Input-robustness observations
│           ├── shared/                  Loop-nesting + recursion detection primitives
│           ├── fixtures/                 7 required-problem example solutions
│           └── solution-analyzer.ts       The one public entry point, analyzeSolution()
│
├── docs/
│   ├── api.md
│   ├── ai-analysis.md
│   ├── document-generation.md
│   ├── github-integration.md
│   ├── improvement-engine.md
│   ├── database.md
│   ├── architecture.md
│   ├── development.md
│   ├── project-overview.md
│   └── phases/
│       ├── phase-01.md
│       ├── phase-02.md
│       ├── phase-03.md
│       ├── phase-04.md
│       ├── phase-05.md
│       ├── phase-06.md
│       ├── phase-07.md
│       ├── phase-08.md
│       └── phase-09.md
│
├── docker-compose.yml   Optional local PostgreSQL (password from your environment)
├── .env.example
├── .gitignore
├── .prettierrc.json / .prettierignore
├── eslint.config.mjs
├── package.json          Root workspace config + shared scripts
├── tsconfig.json          Shared base TypeScript compiler options
└── README.md
```

## 9–12. Folder and file explanations

### `apps/web` — React frontend

Vite + React + TypeScript app — since Phase 8, the learning dashboard. `src/App.tsx` is just a
header plus a route switch over three pages (`src/pages/`): **Dashboard**, **Problems**, and
**Problem detail**, each composed from small reusable components in `src/components/` (`common/`,
`dashboard/`, `problems/`, `detail/`, `layout/`) — deliberately no giant `Dashboard.tsx`.
`src/api/dashboardApi.ts` is a typed fetch client over the dashboard endpoints (proxied to the
backend by Vite's dev server so the frontend never hardcodes a backend port), `src/hooks/useAsync.ts`
tracks loading/error state and ignores stale responses, and `src/router/routes.ts` is a
dependency-free hash router (`#/`, `#/problems`, `#/problems/<id>`). `vite.config.ts` configures the
dev proxy and Vitest's `jsdom` environment. The Phase 1 health check survives as a small
`BackendStatus` widget in the header.

#### The dashboard

- **Dashboard** — stat cards (total problems, accepted, needs improvement, optimal, current
  streak, patterns practiced), difficulty-distribution bars, recent problems, and a table for all
  16 tracked patterns (Hash Map, Two Pointers, Sliding Window, Binary Search, Stack, Queue, BFS,
  DFS, Heap, Greedy, Backtracking, Dynamic Programming, Graph, Tree, Prefix Sum, Sorting) showing
  how many you've solved, your average quality, and links to the problems most worth revisiting.
  Patterns you haven't touched are dimmed, not hidden.
- **Problems** — search plus difficulty/pattern/status/language filters and sortable columns
  (Problem, Difficulty, Pattern, Language, Status, Complexity, Quality, Date, GitHub document).
- **Problem detail** — problem information, **your** code exactly as submitted, the static
  analysis, the AI review (with an explicit notice when it disagreed with the static analysis),
  the better approach (labeled **RECOMMENDED**, never confusable with your code), learning points,
  the GitHub link, and (Phase 9) the **submission history**: every attempt in order with its
  status, runtime, memory, complexity, and quality, an "Improved / Regressed / No change" summary
  with the time-complexity journey, and one comparison card per consecutive pair of attempts.
- **Learning** (Phase 9) — "what to work on" (Practice more / Review) and the learning profile:
  recurring weaknesses and strengths, each with "N of M" evidence and links to example problems,
  a per-pattern level table, and the profile's own limitations.

The dashboard needs the API to have a database (`DATABASE_URL`); without one it shows the API's
clear "the dashboard needs a database" message. See [docs/phases/phase-08.md](docs/phases/phase-08.md).

### `apps/api` — Express backend

`src/index.ts` is the process entry point: it loads environment variables and starts the
HTTP server. `src/app.ts` builds the Express `app` (CORS, request logging, JSON body parsing,
route mounting, a 404 handler, and — last — the centralized error handler) as a factory
function so tests can construct an app instance without binding a real port.
`src/routes/health.route.ts` implements `GET /api/health`.

`POST /api/submissions` (Phase 3 — full reference in [docs/api.md](docs/api.md)) is layered:
`src/schemas/submission.schema.ts` (a Zod schema — the actual runtime-enforced contract, not
just the TypeScript type) → `src/middleware/validateBody.ts` (a generic, reusable
validate-or-400 middleware) → `src/controllers/submissions.controller.ts` (thin: call the
service, respond) → `src/services/submissions.service.ts` (normalizes fields, assigns a
`crypto.randomUUID()` id, records a server-side timestamp) → `src/repositories/
submissions.repository.ts` (a `SubmissionRepository` interface + an `InMemorySubmissionRepository`
implementation, so a real database can implement the same interface later without touching
anything above it — Phase 5 added `findById` to this interface, the first read method it's
needed). `src/middleware/errorHandler.ts` maps every thrown/forwarded error — validation
failures, malformed JSON, anything unexpected — to the same consistent `ApiResponse` envelope
and an appropriate status code, so no route ever hand-rolls its own error response.

`POST /api/submissions/:id/review` (Phase 5 — full reference in
[docs/api.md](docs/api.md#post-apisubmissionsidreview) and
[docs/ai-analysis.md](docs/ai-analysis.md)), `POST /api/submissions/:id/document` (Phase 6 —
full reference in [docs/api.md](docs/api.md#post-apisubmissionsiddocument) and
[docs/document-generation.md](docs/document-generation.md)), and
`POST /api/submissions/:id/publish` (Phase 7 — full reference in
[docs/api.md](docs/api.md#post-apisubmissionsidpublish) and
[docs/github-integration.md](docs/github-integration.md)) all load the stored submission and
then call `src/services/combined-review.service.ts`'s `buildCombinedReview()` (extracted in
Phase 6 so the three endpoints share one implementation instead of drifting apart): it runs
`analyzeSolution()` from `@codereviewai/analysis` fresh, then calls `src/ai/ai-review.service.ts`
— which builds a prompt (`src/ai/prompts/reviewPrompt.ts`), calls an injected `AiProvider`
(`src/ai/providers/` — real implementations call Anthropic's Messages API or Google's Gemini
`generateContent` API, selected by `AI_PROVIDER` via `createProviderFromEnv.ts`; a
`mockProvider.ts` exists for tests only and is excluded from the production build), and
validates the raw response against `src/ai/schemas/solutionReview.schema.ts` before trusting it.
`src/ai/agreement.ts` then compares the deterministic and AI complexity/pattern claims and
reports exactly where they agree or don't (`ai/types.ts`'s `CombinedSolutionReview` keeps both
analyses and the comparison side by side — never merged). Every AI-specific failure is one
`AiReviewError` (`src/ai/errors.ts`), translated to an HTTP status by
`src/controllers/aiErrorMapping.ts` (also extracted in Phase 6, shared by all three controllers).

`reviews.controller.ts` returns the `CombinedSolutionReview` as-is; `documents.controller.ts`
and `publish.controller.ts` both instead pass it to `src/document/document-generator.ts`'s
`generateDocument()`, which builds a complete 18-section Markdown document from
`src/document/templates/*` — each built exclusively from `src/document/markdown/markdown.ts`'s
primitives (`heading()`, `bulletList()`, `codeBlock()`, `table()`, `escapeMarkdown()`) — and
computes a safe filename via `src/document/formatter/filename.ts`. The submitted code is passed
into `codeBlock()` completely unescaped and unmodified (labeled **YOUR SOLUTION**); every other
piece of dynamic text (problem descriptions, AI prose) is run through `escapeMarkdown()` first,
so it can never inject rogue document structure.

`publish.controller.ts` (Phase 7) then hands that generated document to
`src/services/github-publish.service.ts`'s `GitHubPublishService.publish()`, which orchestrates
`src/github/*`'s single-purpose services — `repository.service.ts` (confirms `GITHUB_REPO` is
reachable), `file.service.ts` (checks whether `problems/NNN-slug/README.md` already exists —
this is the duplicate check), `commit.service.ts` (builds a specific, meaningful commit message
like `"docs: add analysis for Two Sum"`), `problemPath.ts` (reuses Phase 6's
`document/formatter/filename.ts` to build the nested repo path), and `readmeTable.ts`
(re-renders and merges the root README's table between HTML-comment markers, byte-for-byte
preserving any hand-written content outside them). A request explicitly states
`mode: "create"` or `"update"`; publishing an already-existing problem in `"create"` mode is
**rejected** with `409 GITHUB_CONFLICT` rather than silently overwritten. Every GitHub call goes
through `src/github/github-client.ts` — the only file that imports `@octokit/rest` — behind a
`GitHubClient` interface every other file depends on instead (a `mockGitHubClient.ts` exists for
tests only and is excluded from the production build).

### `apps/extension` — Chrome Extension (Manifest V3)

`manifest.json` declares an MV3 extension with a popup, a background service worker, and (as
of Phase 2) a content script matching `https://leetcode.com/problems/*`. It requests **zero**
`permissions` and one narrowly-scoped `host_permissions` entry added in Phase 3,
`http://localhost:4000/*` — needed so the popup's `fetch` to the local API isn't blocked by
CORS (a `chrome-extension://<id>` origin can never be pre-added to a server's CORS allowlist,
since unpacked-extension ids aren't stable/known in advance; a declared `host_permissions`
grant is the platform-correct way an MV3 extension bypasses CORS for a specific origin instead).
`src/background/service-worker.ts` and `src/popup/popup.ts` are TypeScript entry points
bundled by `scripts/build.mjs` (an esbuild script, chosen over Vite here because MV3
background/popup/content bundles are simple, independent scripts that don't need a dev server
or HMR). `src/lib/messaging.ts` defines the request/response message contract between the
popup and the content script; `src/lib/api.ts` (Phase 3) is the extension's only
network-calling code — it maps an extraction onto the API's wire contract and POSTs it to
`POST /api/submissions`, returning a typed success/validation-error/error outcome the popup
renders directly.

`src/content/leetcode/` is the dedicated LeetCode extraction adapter (full detail in
[docs/phases/phase-02.md](docs/phases/phase-02.md)):

- **`url.ts`** — a thin re-export of `isLeetCodeProblemUrl`/`extractSlugFromUrl` from
  `@codereviewai/shared` (the logic itself moved there in Phase 3 so the API can validate a
  submitted URL with the exact same check); no DOM access, so it's the cheapest and most
  reliable "is this a problem page" signal.
- **`selectors.ts`** — every LeetCode-specific CSS selector and text whitelist, isolated in
  one file so markup drift only requires updating here, not throughout the codebase.
- **`extractor.ts`** — low-level DOM-reading primitives (each takes its search root as a
  parameter, so it's testable against a plain jsdom document, not just the real page).
- **`parser.ts`** — the single public entry point (`parseLeetCodeExtraction`) that orchestrates
  the above into a fully-typed `LeetCodeExtraction`, with `null` for anything not found and a
  `warnings` list of which fields fell back.
- **`types.ts`** — re-exports the LeetCode domain types from `@codereviewai/shared` so this
  folder's own modules never need to reach outside it.
- **`index.ts`** — the actual content-script entry point injected into the page; listens for a
  popup message and responds with a fresh extraction.

### `packages/shared` — Shared TypeScript types

`src/types/api.ts` defines `ApiResponse<T>` (the success/error envelope every endpoint
returns, extended in Phase 3 with an optional `error.details` for validation issues) and
`HealthStatus` (the health-check payload shape). `src/utils/apiResponse.ts` provides small
`success()` / `failure()` / `isSuccess()` helpers so every package constructs and narrows API
responses the same way. `src/types/leetcode.ts` (added in Phase 2) defines `LeetCodeExtraction`
and its nested types. `src/types/submission.ts` (Phase 3) defines `CreateSubmissionRequest` /
`StoredSubmission` — the `POST /api/submissions` wire contract, reusing the Phase 2 types
as-is. `src/utils/leetcodeUrl.ts` (moved here from the extension in Phase 3) holds
`isLeetCodeProblemUrl`/`extractSlugFromUrl`, so the extension and the API validate a LeetCode
URL with the exact same logic instead of two copies that could drift apart. In Phase 8 it also
holds the dashboard's wire types (`src/types/dashboard.ts`: `DashboardSummary`, `PatternStat`,
`ProblemListItem`, `ProblemDetail`, …) and `src/dashboard/problemQuery.ts`, the one implementation
of problem search/filter/sort, so the API and web app can never disagree about what they mean.

### `packages/analysis` — Deterministic solution-analysis engine

A standalone, dependency-free package: `analyzeSolution({ code, language })` →
`SolutionAnalysis`. `src/pattern-detector/` recognizes 19 algorithm patterns via a modular,
signal-based rule engine (each rule is a list of weighted regex/predicate signals; a pattern is
reported only once matched evidence clears a threshold, with a confidence score that scales
with — but isn't a raw fraction of — every possible signal, since most signals within a rule are
mutually-exclusive language alternatives, not independent corroborating evidence).
`src/complexity-analyzer/` estimates time/space complexity from loop-nesting depth, recursion,
and the already-detected patterns, always stating its reasoning and never claiming
mathematical certainty. `src/code-review/` and `src/edge-case-analyzer/` flag
style/maintainability and input-robustness concerns respectively. `src/shared/codeStructure.ts`
holds the loop-nesting and recursion-detection primitives every other module depends on.
`src/fixtures/` holds real example solutions for the 7 required problems, used throughout the
test suite. As of Phase 5, `analyzeSolution()` is called by `apps/api/src/services/
combined-review.service.ts`'s `buildCombinedReview()` — shared by every
`POST /api/submissions/:id/review` (Phase 5), `POST /api/submissions/:id/document` (Phase 6),
and `POST /api/submissions/:id/publish` (Phase 7) request, recomputed fresh each time rather
than cached. Full detail: [docs/phases/phase-04.md](docs/phases/phase-04.md).

### `docs/`

Project-level documentation, described in [Documentation](#documentation-map) below.

### Root config files

- **`package.json`** — declares the five workspaces and root-level dev tooling
  (TypeScript, ESLint, Prettier) shared by all of them, plus scripts that run a command across
  every workspace.
- **`tsconfig.json`** — the strict, shared base `compilerOptions` every workspace's own
  `tsconfig.json` extends, so strictness settings live in one place.
- **`eslint.config.mjs`** — a single flat ESLint config applied to the whole repo, with
  scoped overrides for React (web) and Chrome extension globals.
- **`.env.example`** — documents every environment variable the project uses now or will use
  in a specific future phase (each future variable is commented out and labeled with the phase
  that introduces it).

## 13. How frontend/backend/extension communicate

- **Frontend ↔ Backend (implemented):** the web app calls relative `/api/...` URLs. In
  development, Vite's dev server proxies these to `http://localhost:4000` (see
  `apps/web/vite.config.ts`), so the frontend code never hardcodes the API's host/port. In
  production, the frontend and API would be served such that `/api` reaches the backend (e.g.
  a reverse proxy) — this is a deployment concern for a later phase.
- **LeetCode page ↔ Extension (implemented):** the content script
  (`apps/extension/src/content/leetcode/index.ts`) reads the current page's DOM directly; the
  popup asks it for fresh data via `chrome.tabs.sendMessage`/`chrome.runtime.onMessage` on
  demand, rather than trusting a stale extraction from page load.
- **Extension ↔ Backend (implemented):** the popup's **Submit Solution** button
  (`apps/extension/src/lib/api.ts`) POSTs a fresh extraction to `POST /api/submissions`,
  bypassing CORS via the extension's `host_permissions` grant for `http://localhost:4000`
  (rather than the API loosening its `CORS_ORIGIN` config — see [Security
  considerations](#23-security-considerations)).
- **All three ↔ Shared types:** `apps/web`, `apps/api`, and `apps/extension` all depend on
  `@codereviewai/shared` for TypeScript types, so a change to a shared contract (like
  `ApiResponse<T>`) is caught by the type checker in every consumer at once.
- **`packages/analysis` ↔ `apps/api` (implemented, Phase 5):** `analyzeSolution()` is now a
  real dependency of `apps/api`, called fresh on every `POST /api/submissions/:id/review`,
  `POST /api/submissions/:id/document`, and `POST /api/submissions/:id/publish` request.
- **`apps/api` ↔ Anthropic/Gemini API (implemented, Phase 5, server-side only):** the AI review
  layer calls the selected vendor's API directly over `fetch` (Anthropic's Messages API or
  Google's Gemini `generateContent` API, chosen by `AI_PROVIDER`), behind the swappable
  `AiProvider` interface. `AI_PROVIDER_API_KEY` is read once, server-side, when constructing the
  real provider — it's never included in any HTTP response, and neither `apps/web` nor
  `apps/extension` has any code path that could read it. See
  [docs/ai-analysis.md](docs/ai-analysis.md#privacy).
- **`apps/api` ↔ GitHub API (implemented, Phase 7, server-side only):** the publishing layer
  calls the GitHub REST API via `@octokit/rest`, behind the swappable `GitHubClient` interface.
  `GITHUB_TOKEN` is read once, server-side, when constructing the real client — it's never
  included in any HTTP response, and neither `apps/web` nor `apps/extension` has any code path
  that could read it. See
  [docs/github-integration.md](docs/github-integration.md#authentication-and-token-handling).
- **Frontend ↔ Backend, dashboard (implemented, Phase 8):** `apps/web` reads `GET /api/dashboard/summary`,
  `/api/dashboard/patterns`, `/api/problems`, and `/api/problems/:id` through its typed client. These
  are read-only and never call the AI or GitHub. See [docs/api.md](docs/api.md#dashboard-endpoints).
- **`apps/api` ↔ PostgreSQL (implemented, Phase 8, optional, server-side only):** repositories talk
  to a `Database` interface; `pgDatabase.ts` (the only file importing `pg`) implements it from
  `DATABASE_URL`, which is read once, never logged, and never reaches the browser. See
  [docs/database.md](docs/database.md).
- **`POST /api/submissions/:id/review` ↔ `.../document` ↔ `.../publish` (implemented, Phase
  6–7):** all three endpoints call the same `buildCombinedReview()` helper
  (`apps/api/src/services/combined-review.service.ts`), so a generated document — whether
  returned directly or committed to GitHub — is always built from a review computed the
  identical way, never a separately-derived or stale one.

## 14–17. Development setup, installation, environment variables, running

### Prerequisites

- Node.js ≥ 20 (developed against Node 24)
- npm ≥ 10 (ships with modern Node)
- An API key for an AI provider (`AI_PROVIDER_API_KEY`) is needed **only** to actually call
  `POST /api/submissions/:id/review`, `.../document`, or `.../publish` — every other command,
  endpoint, and test works with no key configured at all.
- A GitHub personal access token (`GITHUB_TOKEN`) and target repository (`GITHUB_REPO`) are
  needed **only** to actually call `POST /api/submissions/:id/publish` — every other command,
  endpoint, and test works with no GitHub configuration at all.
- A PostgreSQL database (`DATABASE_URL`) is needed **only** for the dashboard and for persisting
  submissions across restarts — without one the API runs as before (in-memory) and the dashboard
  answers `503`. `docker compose up -d` starts a local one (see [docs/database.md](docs/database.md)).
  **Tests never need Postgres** — they run real Postgres SQL in-process (PGlite).

### Installation

```bash
npm install
```

This installs every workspace's dependencies and automatically builds `packages/shared` and
`packages/analysis` (via a `postinstall` hook), since the API and web app resolve both as
normal npm packages.

### Environment variables

Copy `.env.example` and fill in real values as needed:

```bash
cp .env.example apps/api/.env
```

| Variable             | Used by  | Default                 | Purpose                                                        |
| -------------------- | -------- | ------------------------ | ---------------------------------------------------------------- |
| `PORT`               | apps/api | `4000`                    | Port the Express server listens on.                              |
| `NODE_ENV`           | apps/api | `development`             | Standard Node environment flag.                                   |
| `CORS_ORIGIN`        | apps/api | `http://localhost:5173`   | Origin allowed to call the API.                                    |
| `AI_PROVIDER`         | apps/api | `anthropic`                | Which AI vendor to call: `anthropic` or `gemini`.                  |
| `AI_PROVIDER_API_KEY` | apps/api | *(none)*                  | API key for the selected provider. Only `POST /api/submissions/:id/review` needs it — every other endpoint works fully without it. |
| `AI_PROVIDER_MODEL`   | apps/api | `claude-sonnet-5` (Anthropic) / `gemini-3.6-flash` (Gemini) | Which model the review endpoint calls.       |
| `GITHUB_TOKEN`        | apps/api | *(none)*                   | A personal access token (Contents read/write on the target repo). Only `POST /api/submissions/:id/publish` needs it — every other endpoint works fully without it. |
| `GITHUB_REPO`         | apps/api | *(none)*                   | The target repository to publish into, as `"owner/repo"`.          |
| `DATABASE_URL`        | apps/api | *(none)*                   | PostgreSQL connection string. Optional — enables the dashboard and persistent storage; migrations run at startup. Contains a password: never commit it. |
| `DATABASE_SSL`        | apps/api | `false`                    | Set `true` for hosted Postgres that requires TLS.                  |
| `POSTGRES_PASSWORD`   | docker-compose | *(none)*             | Only for `docker-compose.yml`: the local dev database's password, read from your environment.  |

### Running the project

```bash
# Run the frontend and backend together
npm run dev

# Or run them individually
npm run dev:web    # http://localhost:5173  (the dashboard)
npm run dev:api    # http://localhost:4000

# Optional: a local PostgreSQL for the dashboard
POSTGRES_PASSWORD=choose-one docker compose up -d
# put DATABASE_URL=postgres://codereviewai:choose-one@localhost:5432/codereviewai in apps/api/.env
npm run db:migrate -w @codereviewai/api    # or just start the API — it migrates at startup

# Build the extension (loads via chrome://extensions → "Load unpacked" → apps/extension/dist)
npm run build -w @codereviewai/extension
```

To try the extension: build it, load `apps/extension/dist` as an unpacked extension in Chrome,
open any `https://leetcode.com/problems/<slug>/` page, then click the extension icon and press
**Extract Problem**. With `npm run dev:api` (or `npm run start -w @codereviewai/api`) running,
**Submit Solution** sends the extraction to the API and shows the stored result — see
[docs/api.md](docs/api.md) for the endpoint it calls.

To try the AI review (Phase 5), document generation (Phase 6), or GitHub publishing (Phase 7) —
no extension/web UI triggers any of them yet, so use `curl` or similar: set
`AI_PROVIDER_API_KEY` (and, for publishing, `GITHUB_TOKEN`/`GITHUB_REPO`) in `apps/api/.env`,
create a submission as above to get an `id`, then
`curl -X POST http://localhost:4000/api/submissions/<id>/review`,
`curl -X POST http://localhost:4000/api/submissions/<id>/document`, or
`curl -X POST http://localhost:4000/api/submissions/<id>/publish -H "Content-Type:
application/json" -d '{"mode":"create"}'`. Without the relevant configuration, each endpoint
still responds — with a clear `502 AI_PROVIDER_ERROR` or `502 GITHUB_AUTH_FAILED` — rather than
crashing the server; every other endpoint is completely unaffected either way.

## 18. Testing

```bash
npm run test               # run every workspace's test suite
npm run test -w @codereviewai/api        # a single workspace
npm run test:watch -w @codereviewai/web  # watch mode (per-workspace script)
```

Each workspace uses Vitest — 730 tests total. `apps/api` additionally uses Supertest to
exercise the Express app over HTTP without binding a real port, covering `POST /api/submissions`
at every layer (schema rules, service normalization, repository round-trips, and full
HTTP-level integration — valid submission, invalid submission, missing code, invalid language,
invalid URL, malformed/non-JSON payload), `POST /api/submissions/:id/review` (since Phase 5 — a
full create-then-review round trip, an end-to-end disagreement scenario using real nested-loop
code against a mocked AI claiming the wrong complexity, a 404 for an unknown id, and one test
per AI failure mode mapped to its HTTP status), `POST /api/submissions/:id/document` (since
Phase 6 — the same error-mapping coverage, plus 35 dedicated `document-generator.test.ts` tests
checking every required section is present and in order, exact byte-for-byte code preservation
including code containing its own triple-backtick sequences, that the submitted code and a
populated "Better Approach" are never confused, correct handling of every missing/empty
optional field, and that Markdown-significant characters embedded in AI prose or an extracted
problem description can never inject rogue document structure), and
`POST /api/submissions/:id/publish` (since Phase 7 — repository lookup, file creation and
update, duplicate detection in both directions — a `"create"` against an existing problem is
rejected, an `"update"` against a nonexistent one is rejected — the byte-identical-content no-op
path, commit-message generation that's asserted to never be generic, and every GitHub API
failure mode), and the four dashboard endpoints (since Phase 8 — every filter, search, sort, and
validation error; the full problem detail; recording of documents and GitHub links; best-effort
recording failure; and `503` with no database) against **real Postgres SQL run in-process via PGlite**
— which also backs the migration tests (idempotence, rollback, ordering, constraints) and the
repository tests (exact code round-trip, upserts, latest-submission-per-problem, per-user isolation);
the pure analytics (quality score, streaks, pattern normalization, statistics) have 73 tests of their
own; `apps/web` (95 tests) uses React Testing Library with a `jsdom` environment to test every
dashboard component, the three pages (loading, error/retry, filtering and sorting driven through the
API), routing, and the `useAsync` hook (including stale-response handling); `packages/shared` tests
the shared filter/sort functions; `apps/extension`'s LeetCode adapter tests construct synthetic pages with `jsdom`'s `JSDOM` class
directly (URL detection, slug/title/difficulty/code extraction, and — importantly — that
missing fields come back `null` instead of guessed values), and `lib/api.test.ts` exercises the
extension's API client against a stubbed `fetch`; `packages/analysis` (73 tests) covers every
pattern-detection rule, every complexity/code-quality/edge-case heuristic, and all 7
required-problem fixtures run end-to-end through `analyzeSolution()`. **No test anywhere makes a
real AI or GitHub API call, and none needs a Postgres server** — every AI-facing test in `apps/api/src/ai/` and
`apps/api/src/document/` uses `providers/mockProvider.ts` or a mocked `fetch`, and every
GitHub-facing test in `apps/api/src/github/` uses `mockGitHubClient.ts` or an injected mock
`fetch`.

## 19. Code quality commands

```bash
npm run typecheck    # tsc --noEmit across every workspace
npm run lint          # ESLint across the whole repo
npm run lint:fix       # ESLint with autofix
npm run format          # Prettier --write across the whole repo
npm run format:check     # Prettier --check (used in CI-style verification)
```

## 20. Development roadmap

| Phase | Focus                                                                 |
| ----- | ---------------------------------------------------------------------- |
| 1     | Project foundation — monorepo, skeleton apps, tooling (complete)       |
| 2     | Chrome extension: read problem + submission data from the LeetCode DOM (complete) |
| 3     | API: endpoints to receive and store captured submissions (complete)    |
| 4     | Deterministic (non-AI) solution-analysis engine: pattern detection, complexity heuristics, code quality, edge cases (complete) |
| 5     | AI-powered solution review, layered on top of Phase 4's deterministic analysis (complete) |
| 6     | Learning document generation from the combined review (complete)       |
| 7     | GitHub integration: commit generated documents automatically (complete) |
| 8     | Web dashboard, learning analytics, and PostgreSQL persistence (complete) |
| 9     | Improvement tracking: attempt history, comparison, learning profile, recommendations (this phase) |
| 10    | Polish, deployment, end-to-end hardening                               |

*(Note: an earlier draft of this table listed "persistence layer" as Phase 4, and a later draft
folded persistence into Phase 6 alongside document generation — Phase 4 turned out to be the
analysis engine documented below, and Phase 6 turned out to be document generation only, with no
persistence. Each phase's actual scope is set by that phase's own kickoff instructions, not
predicted in advance by this table. Database persistence finally arrived in Phase 8, alongside
the dashboard that first needed it.)*

## 21. Phase status

- **Phase 1 — Project Foundation: complete.** See
  [docs/phases/phase-01.md](docs/phases/phase-01.md).
- **Phase 2 — LeetCode Extraction: complete.** See
  [docs/phases/phase-02.md](docs/phases/phase-02.md).
- **Phase 3 — Submission API: complete.** See
  [docs/phases/phase-03.md](docs/phases/phase-03.md).
- **Phase 4 — Deterministic Solution Analysis: complete.** See
  [docs/phases/phase-04.md](docs/phases/phase-04.md).
- **Phase 5 — AI-Powered Solution Review: complete.** See
  [docs/phases/phase-05.md](docs/phases/phase-05.md) and
  [docs/ai-analysis.md](docs/ai-analysis.md) for the full record of what was built, verified,
  and why.
- **Phase 6 — Document Generation: complete.** See
  [docs/phases/phase-06.md](docs/phases/phase-06.md) and
  [docs/document-generation.md](docs/document-generation.md) for the full record of what was
  built, verified, and why.
- **Phase 7 — GitHub Integration: complete.** See
  [docs/phases/phase-07.md](docs/phases/phase-07.md) and
  [docs/github-integration.md](docs/github-integration.md) for the full record of what was
  built, verified, and why.

- **Phase 8 — Dashboard & Learning Analytics: complete.** See
  [docs/phases/phase-08.md](docs/phases/phase-08.md) and [docs/database.md](docs/database.md) for the
  full record of what was built, verified, and why.

- **Phase 9 — Improvement Tracking: complete.** See
  [docs/phases/phase-09.md](docs/phases/phase-09.md) and
  [docs/improvement-engine.md](docs/improvement-engine.md) for the full record of what was built,
  verified, and why.

Phase 10 has not been started.

## 22. Future architecture

Later phases add, without changing what exists today:
- **OAuth-based GitHub authentication**, replacing the single `GITHUB_TOKEN` (Phase 7's MVP)
  with a per-user flow — `github/auth.ts`'s `GitHubAuthProvider` interface was built specifically
  so this is a new implementation of that interface, not a change to `github-client.ts` or
  anything above it. See
  [docs/github-integration.md#future-oauth-design](docs/github-integration.md#future-oauth-design).
- **Authentication and per-user data** (not scheduled in any phase yet): real accounts replacing the seeded `local` user.
  The schema is ready for it — `user_id` is on every submission and every repository query is
  already scoped by it — so this adds login, not a schema rewrite.
- Pagination and SQL-side aggregation for the problem list and dashboard once a dataset outgrows
  application-code aggregation (the GIN indexes are already in place), and *review* history (Phase 9 tracks
  every *attempt*, but each submission still keeps only its latest analysis/review/document).
- Retry logic and response caching for AI review/document-generation/publish requests, and
  extension/web UI that actually triggers `POST /api/submissions/:id/review`,
  `.../document`, or `.../publish` (see
  [docs/ai-analysis.md#limitations](docs/ai-analysis.md#limitations),
  [docs/document-generation.md#limitations](docs/document-generation.md#limitations), and
  [docs/github-integration.md#limitations](docs/github-integration.md#limitations)).
- UI that *triggers* a review, document generation, or publish from the dashboard or extension
  (today the dashboard only displays what those endpoints recorded).
- **`patterns/` in the published repository** — reserved but deliberately unimplemented in
  Phase 7 ("do not overbuild pattern files yet").

Full detail and diagrams: [docs/architecture.md](docs/architecture.md).

## 23. Security considerations

- No secrets are committed to the repository; `.env.example` documents variable names only,
  and `.gitignore` excludes all `.env*` files.
- CORS on the API is restricted to a configured origin (`CORS_ORIGIN`), not left wide open —
  and was **not** loosened to accommodate the extension (see the next point).
- The Chrome extension requests **zero explicit `permissions`** and exactly one narrowly-scoped
  `host_permissions` entry, `http://localhost:4000/*` (added in Phase 3, for the extension to
  call the local API — a `chrome-extension://<id>` origin can't be pre-added to a server's CORS
  allowlist since unpacked-extension ids aren't known in advance, so a declared
  `host_permissions` grant is the platform-correct bypass instead of loosening the server's
  CORS policy). The Phase 2 content script's page access still comes entirely from its
  `content_scripts.matches` entry, not a permission grant.
- **The API never trusts client input.** Every field of `POST /api/submissions` is validated
  server-side by a Zod schema independent of the TypeScript wire type — a URL is checked
  against the real LeetCode-URL predicate (not just "is a URL"), language/status/difficulty
  are checked against exact whitelists (not just "is a string") — and the server records its
  own `metadata.receivedAt` rather than only trusting the client's `metadata.extractedAt`. See
  [docs/phases/phase-03.md](docs/phases/phase-03.md#validation).
- Submitted code is stored as opaque string data — nothing in `apps/api` parses or executes any
  part of a submitted payload. The Phase 4 analysis engine holds the same line: every check is
  a regex/text heuristic over the source string — no `eval`, no sandboxed execution, nothing
  that runs submitted code. The Phase 5 AI review layer sends the code as prompt text and gets
  text back; it never executes it either. The Phase 6 document generator embeds that same code,
  byte-for-byte, inside a Markdown fence — displayed, never executed — and Phase 7 commits that
  exact fenced document to GitHub unchanged, still never executing anything.
- **Generated documents can't be used to inject Markdown structure.** Every piece of dynamic
  prose in a Phase 6 document (problem descriptions, every AI-generated string) is run through
  `document/markdown/markdown.ts`'s `escapeMarkdown()` first, which neutralizes leading
  heading/list/blockquote/code-fence markers and escapes inline-significant characters — an AI
  response or extracted description can never inject a rogue heading, list item, or break out
  of a fenced code block. See
  [docs/document-generation.md#escaping](docs/document-generation.md#escaping).
- **The AI provider API key never reaches the browser, the extension, or the frontend.**
  `AI_PROVIDER_API_KEY` is read exactly once, server-side, in
  `apps/api/src/ai/providers/createProviderFromEnv.ts` when constructing the real provider
  (Anthropic or Gemini, per `AI_PROVIDER`) — never included in any HTTP response, and nothing in
  `apps/web`/`apps/extension` has any code path that could read it.
- **The AI request sends only what's needed to review the code** — the problem, the submitted
  code/language, and Phase 4's deterministic analysis. A submission's `id` and
  `metadata.receivedAt`/`extractedAt`/`source` are never forwarded, since none of them would
  improve the review. See [docs/ai-analysis.md#privacy](docs/ai-analysis.md#privacy).
- **AI output is never trusted blindly.** A raw AI response must pass a strict Zod schema
  before it's used anywhere, and its complexity/pattern claims are explicitly compared
  against — never silently substituted for — Phase 4's independently-computed analysis. See
  [docs/ai-analysis.md](docs/ai-analysis.md#hallucination-mitigation).
- **The GitHub token never reaches the browser, the extension, or the frontend — a verified
  property, as of Phase 7.** `GITHUB_TOKEN` is read exactly once, server-side, in
  `apps/api/src/github/auth.ts` (via `github/createGitHubClientFromEnv.ts`) — never hardcoded,
  never logged, and never included in any HTTP response (`PublishResult` returns a `commitUrl`,
  not the token). See
  [docs/github-integration.md#authentication-and-token-handling](docs/github-integration.md#authentication-and-token-handling).
- **Database credentials never enter the repository or the logs.** `DATABASE_URL` (which contains
  the password) is read once, server-side, in `persistence/createDatabaseFromEnv.ts`; `.env` is
  gitignored and `.env.example` documents names only. `docker-compose.yml` reads
  `POSTGRES_PASSWORD` from your environment and refuses to start without it. Every SQL statement is
  parameterized (no value is ever concatenated into SQL), and recording failures log only an error
  *message* — never SQL parameters, which contain submitted code. See
  [docs/database.md](docs/database.md#configuration-and-secrets).
- **The dashboard renders submitted code and AI text as plain text**, never as markup — React
  escapes it, and code is shown in a `<pre><code>` block — so a submission or AI response
  containing `<script>` or HTML cannot inject anything into the page (there's a test with exactly
  that content).
- **A duplicate is never silently overwritten.** `POST /api/submissions/:id/publish` rejects a
  `mode: "create"` request against a problem that's already published (`409 GITHUB_CONFLICT`)
  rather than overwriting it; an intentional overwrite requires the caller to explicitly pass
  `mode: "update"`. See
  [docs/github-integration.md#duplicate-handling](docs/github-integration.md#duplicate-handling).
- **Every GitHub write path is sanitized against path traversal.** `github/problemPath.ts`
  reuses Phase 6's slug-sanitization logic, so a malformed problem slug (`../../etc/passwd`-shaped
  input) collapses into ordinary hyphens rather than writing outside `problems/`.

## 24. GitHub integration

**Implemented as of Phase 7.** See
[GitHub publishing](#25-ai-integration-document-generation-and-github-publishing) below for the
full description, and [docs/github-integration.md](docs/github-integration.md) for the complete
design (repository layout, commit process, duplicate handling, and the future OAuth design).

## 25. AI integration, document generation, and GitHub publishing

**AI integration implemented as of Phase 5.** `POST /api/submissions/:id/review` runs Phase 4's
deterministic `analyzeSolution()` first, then sends the problem, the submitted code, and that
deterministic analysis to the configured AI provider — Anthropic Claude or Google Gemini,
selected via `AI_PROVIDER` and configured via `AI_PROVIDER_API_KEY`/`AI_PROVIDER_MODEL` — with a
structured prompt answering all 16 required review questions (approach, pattern, why it works,
complexity, strengths, improvements, correctness concerns, missed edge cases, optimality, a
better approach if one exists and why, learning points, and related patterns to practice). The
raw response is validated against a strict Zod schema before it's trusted, and its
complexity/pattern claims are explicitly compared against Phase 4's — not blindly trusted, and
never silently merged; any disagreement is surfaced in the response's `agreement` field. Every
AI failure mode (timeout, provider error, rate limit, malformed/invalid response) maps to a
specific HTTP status rather than crashing the process. See
[docs/ai-analysis.md](docs/ai-analysis.md) for the full architecture, and
[docs/phases/phase-05.md](docs/phases/phase-05.md) for a worked example, including a
disagreement example.

**Document generation implemented as of Phase 6.** `POST /api/submissions/:id/document` reuses
that exact same pipeline (via `buildCombinedReview()`, shared between both endpoints) and turns
the resulting `CombinedSolutionReview` into a complete, 18-section Markdown document —
`document/document-generator.ts` and its `templates/`/`markdown/`/`formatter/` submodules,
described in [Repository structure](#8-repository-structure) above. The submitted code is
embedded exactly as submitted, labeled **YOUR SOLUTION**; a recommended alternative (when one
exists) is labeled **RECOMMENDED SOLUTION** and includes working pseudocode and code — a small
extension to Phase 5's AI schema, since the review endpoint's data didn't previously carry
runnable code. See [docs/document-generation.md](docs/document-generation.md) for the full
schema, and [docs/phases/phase-06.md](docs/phases/phase-06.md) for a worked example generated
live against the real Gemini API.

**GitHub publishing implemented as of Phase 7.** `POST /api/submissions/:id/publish` reuses that
exact same document (via `generateDocument()`, called from the exact same
`buildCombinedReview()` result) and commits it to a configured repository:
`problems/NNN-slug/README.md`, a structured `problems/index.json`, and a root `README.md` table
kept in sync between clear HTML-comment markers — never destroying hand-written README content
outside them. Every GitHub call goes through `@octokit/rest`, isolated behind a swappable
`GitHubClient` interface (mirroring the AI provider abstraction exactly — one interface, one
real implementation, one test-only mock). A request states `mode: "create"` or `"update"`
explicitly; publishing an already-existing problem in `"create"` mode is **rejected**
(`409 GITHUB_CONFLICT`) rather than silently overwritten, and every write gets a specific commit
message (`"docs: add analysis for Two Sum"`, never a generic one). Token-based auth only for
now (`GITHUB_TOKEN`) — `github/auth.ts`'s `GitHubAuthProvider` interface is built so a future
OAuth flow is a new implementation of that interface, not a rewrite. See
[docs/github-integration.md](docs/github-integration.md) for the full design, and
[docs/phases/phase-07.md](docs/phases/phase-07.md) for a complete worked example (the exact
GitHub API calls a publish makes, and the resulting repository layout). **Not yet built:** OAuth
(token-only for now), and no web/extension UI triggers a publish yet — the endpoint returns
everything a UI would need (`status`, `path`, `commitUrl`), but nothing calls it outside tests
and manual `curl` requests.

## 26. Contribution / development guidelines

- Every workspace uses strict TypeScript — avoid `any`; ESLint's
  `@typescript-eslint/no-explicit-any` rule is set to `error`.
- Run `npm run typecheck && npm run lint && npm run test` before considering a change done.
- Keep shared, cross-cutting types in `packages/shared`; don't duplicate type definitions
  across `apps/*`.
- Each phase should only implement what that phase's objectives call for — see
  `docs/phases/` for what's in scope per phase, and don't build ahead of the current phase.
- Update this README and the relevant `docs/phases/phase-NN.md` file whenever a phase adds or
  changes something documented here.

## 27. Known limitations

- LeetCode's DOM is not publicly documented and changes without notice; the selectors in
  `apps/extension/src/content/leetcode/selectors.ts` are best-effort and were **not verified
  against the live leetcode.com site** in this environment (no browser automation was
  available) — see [docs/phases/phase-02.md](docs/phases/phase-02.md#15-leetcode-compatibility-risks)
  for the compatibility-risk breakdown and how the adapter degrades (returns `null`, never a
  guess) when a selector stops matching.
- Submitted-code extraction reads whatever `.view-line` elements Monaco currently has rendered
  in the DOM; this can be incomplete or lose exact whitespace/indentation for long files, and
  is explicitly best-effort.
- **Persistence needs a database.** Since Phase 8, submissions, analyses, reviews, and documents
  persist in PostgreSQL — but only when `DATABASE_URL` is set. Without it the API keeps submissions
  in memory (lost on restart) and the dashboard endpoints answer `503 DATABASE_NOT_CONFIGURED`.
  See [docs/database.md](docs/database.md#limitations).
- **The dashboard UI has never been rendered in a real browser** — no browser automation was
  available. It was verified by typecheck, a production `vite build`, and 102 jsdom tests against a
  mocked `fetch`; the layout, dark-mode appearance, and responsiveness have not been looked at by a
  human. Opening `http://localhost:5173` with the API and a database running is the recommended
  first check.
- **The database layer was never run against a stock PostgreSQL server** (no install or running
  Docker daemon here); `docker-compose.yml` has never been started. The SQL ran on PGlite (real
  Postgres semantics) in-process and, for the `pg` driver, over a wire-protocol socket. See
  [docs/database.md](docs/database.md#limitations).
- **Improvement-engine limits (Phase 9):** the profile and recommendations are rule-based
  heuristics over stored data with fixed thresholds (a weakness needs at least 2 occurrences), not
  a model of the learner; pattern suggestions come from keyword matching in the AI's better-approach
  text; a submission's attempt number is its order of arrival, so a resubmission of unchanged code
  counts as an attempt; "explanations are weak"-style weaknesses are **not** produced because no
  explanation quality is stored. See [docs/improvement-engine.md](docs/improvement-engine.md#limitations).
  The new Learning page and history section have, like the dashboard, never been rendered in a real
  browser.
- **Dashboard details to know:** one row per problem from its *latest* submission (each submission
  keeps only its latest analysis/review/document); streaks use UTC days;
  untracked patterns (`Brute Force`, `Recursion`) count toward totals but no pattern row; the
  quality score's weights are judgment calls; no pagination on the problem list; search refetches on
  every keystroke; recording a review is best-effort (a failed write is logged, not retried).
- There's still no `GET /api/submissions/:id` for a raw submission — the dashboard's
  `GET /api/problems/:id` returns a submission's full detail, and review/document/publish look it
  up internally.
- **No local document persistence.** `POST /api/submissions/:id/document` returns the generated
  Markdown in the response only; nothing is saved to disk. `POST /api/submissions/:id/publish`
  does commit it to GitHub (Phase 7), but that's the only place it's persisted — see
  [docs/document-generation.md#limitations](docs/document-generation.md#limitations) and
  [docs/github-integration.md#limitations](docs/github-integration.md#limitations).
- **Phase 4's analysis engine has its own heuristic limitations** (no AST/execution, functional
  iteration not counted as looping, regexes that assume one balanced paren pair) — see
  [docs/phases/phase-04.md](docs/phases/phase-04.md#limitations). These carry through to the
  AI review, which is grounded in that same deterministic analysis.
- **The real Anthropic provider was never exercised against the live API in this
  environment** — no Anthropic key has been available here. **The Gemini provider was
  exercised once, manually, against the live API** (a real `AI_PROVIDER=gemini` review call
  returned a well-formed, schema-valid response and a genuine surfaced disagreement), but that
  was a single ad hoc check, not a repeatable one — every automated test, for both providers,
  uses a mocked provider or a mocked `fetch`. See
  [docs/ai-analysis.md#limitations](docs/ai-analysis.md#limitations).
- **No retry logic or response caching for AI reviews, generated documents, or GitHub
  publishes** — a transient failure surfaces immediately as an error rather than being retried,
  and calling any of the three endpoints twice for the same submission redoes the full work (a
  fresh AI call, plus up to three fresh GitHub commits for `/publish`), at full cost, each time.
- **No extension or web UI *triggers* a review, a document generation, or a publish yet** — all
  three endpoints exist, are fully tested, and work when called directly (e.g. via `curl`), but
  nothing in `apps/extension`/`apps/web` calls any of them (the dashboard only *displays* what they
recorded).
- **The document generator's escaping targets GitHub-Flavored Markdown, not strict CommonMark**,
  and "Is My Solution Optimal?" only ever answers Yes/No (Phase 5's `optimality.isOptimal` is a
  plain boolean, not a tri-state) — see
  [docs/document-generation.md#limitations](docs/document-generation.md#limitations).
- **GitHub publishing was never exercised against the real GitHub API in this environment** —
  no GitHub token was available (or appropriate to use, given a real commit's permanence) here.
  Every test uses a mocked `GitHubClient` or an injected mock `fetch`. See
  [docs/github-integration.md#limitations](docs/github-integration.md#limitations).
- **No OAuth for GitHub** — only a single, manually-issued personal access token
  (`GITHUB_TOKEN`), per Phase 7's explicit MVP scope. The abstraction is ready
  (`GitHubAuthProvider`), but no OAuth implementation exists. See
  [docs/github-integration.md#future-oauth-design](docs/github-integration.md#future-oauth-design).
- **A publish is up to three separate, non-atomic commits** (the problem document,
  `problems/index.json`, and the root README), not one — GitHub's simple Contents API was used
  for MVP simplicity over the lower-level Git Data API, which could batch them into one commit.
- **`patterns/` in the published repository is unimplemented** — reserved in the documented
  layout, written by no code, per Phase 7's explicit "do not overbuild" instruction.
- No authentication or multi-user support — every request is trusted as the extension's own
  user; everything belongs to one seeded local user (the schema is ready for accounts).
- The extension has not been loaded as an unpacked extension into an actual Chrome browser
  window against the live LeetCode site (with the API running) as part of this phase's
  verification (no browser automation was available in this environment) — it has been
  verified to build correctly, and its extraction and API-client logic are each covered by
  unit/integration tests against synthetic fixtures/a stubbed `fetch`, and the API was verified
  directly via `curl`/Supertest — but the two were not exercised together through an actual
  browser. Manually loading the extension and testing the full flow against a real problem page
  (with `npm run dev:api` running) is the most important recommended follow-up before relying
  on it further.

## 28. Future improvements

- Add CI (GitHub Actions) running `typecheck`, `lint`, `format:check`, and `test` on every
  push, once the repository is pushed to GitHub.
- Consider Turborepo/Nx if the workspace dependency graph or CI time grows significantly.
- Add end-to-end tests once there's a real user flow spanning extension → API → AI → GitHub.
- Manually verify the extraction selectors against the live leetcode.com site and adjust
  `selectors.ts` as needed — this repository's tests validate the extraction *logic* against
  synthetic fixtures, not the current real-world markup.
- Manually verify the full extension → API flow (**Submit Solution**, with the API running)
  against a live LeetCode page — see Known Limitations above.
- Replace the dev-only `console.log` request logger with a structured logger (pino/winston)
  before this ever runs somewhere log volume or format matters.
- Extend `packages/analysis`'s loop-nesting detection to count functional iteration
  (`.forEach`/`.map`/`.filter`/`.reduce`) as looping, not just `for`/`while` — see
  [docs/phases/phase-04.md](docs/phases/phase-04.md#limitations).
- Stress-test the remaining `[^)]*`-shaped regex signals in `pattern-detector/rules/` (Stack,
  BFS/DFS) against nested function calls the way the Sliding Window signal's bug was caught and
  fixed in Phase 4.
- Verify `ai/providers/anthropicProvider.ts` against a real Anthropic API call with a real key
  — every test mocks the provider, so its request-building/response-parsing logic has never
  been confirmed against Anthropic's actual live response format.
- Add retry-with-backoff for transient AI provider failures, and response caching to avoid
  paying for a repeated review of the same submission.
- Improve `ai/agreement.ts`'s complexity comparison from a normalized string match toward a
  light symbolic equivalence check (e.g. so `"O(n + m)"` and `"O(m + n)"` aren't flagged as
  disagreeing) — see [docs/ai-analysis.md#limitations](docs/ai-analysis.md#limitations).
- Widen `SolutionReview.optimality` from a plain boolean to a 3-state
  `Yes`/`No`/`Depends`-shaped answer, so the document's "Is My Solution Optimal?" section can
  express genuine ambiguity instead of only ever answering Yes or No — see
  [docs/document-generation.md#limitations](docs/document-generation.md#limitations).
- Save a generated document to disk (or object storage) and/or add a document-persistence
  layer once real (database) persistence exists, so `POST /api/submissions/:id/document` isn't
  regenerated from scratch, at full AI cost, on every call for the same submission.
- Verify `github/github-client.ts` against a real GitHub API call with a real token and a
  disposable test repository — every test mocks the client or injects a mock `fetch`, so its
  request-building/response-parsing logic has never been confirmed against GitHub's actual live
  response format.
- Implement OAuth-based GitHub authentication (`github/auth.ts`'s `GitHubAuthProvider` is ready
  for it) once the project has user accounts — see
  [docs/github-integration.md#future-oauth-design](docs/github-integration.md#future-oauth-design).
- Move from GitHub's simple Contents API to the lower-level Git Data API so a publish's problem
  document, index, and README updates land as one atomic commit instead of up to three separate
  ones.
- Add retry-with-backoff for transient GitHub API failures, matching the planned AI-provider
  retry behavior above.
- Look at the dashboard in a real browser and fix whatever the tests couldn't see (layout,
  responsiveness, dark mode); add pagination, a debounced search, and trend charts once review
  history exists.
- Run the migrations and the app against a real PostgreSQL server (`docker compose up -d`) and a
  hosted one (TLS via `DATABASE_SSL`), and add a retry/queue for failed dashboard recording.
- Add "Review", "Generate document", and "Publish" buttons to the dashboard's detail page so the
  whole workflow can be driven from the UI instead of `curl`.
- Build out `patterns/` in the published repository once there's a clear design for what a
  per-pattern file should contain — deliberately deferred in Phase 7 ("do not overbuild").

---

## Documentation map

- [docs/project-overview.md](docs/project-overview.md) — project purpose, intended user
  workflow, and the full future data flow from LeetCode to GitHub.
- [docs/architecture.md](docs/architecture.md) — system architecture, data flow, and security
  boundaries, with diagrams.
- [docs/api.md](docs/api.md) — every API endpoint: method, URL, purpose, request/response
  shapes, error codes, examples.
- [docs/ai-analysis.md](docs/ai-analysis.md) — the AI review layer's architecture, prompt
  design, structured-output validation, deterministic-vs-AI comparison, hallucination
  mitigation, limitations, privacy, and cost considerations.
- [docs/document-generation.md](docs/document-generation.md) — the document generation layer's
  schema, template architecture, filename strategy, escaping rules, and exact-code-preservation
  guarantee.
- [docs/github-integration.md](docs/github-integration.md) — the GitHub publishing layer's API
  usage, authentication and token handling, repository structure, commit process, duplicate
  handling, and future OAuth design.
- [docs/database.md](docs/database.md) — the PostgreSQL schema, relationships, indexes, why each
  table exists, migrations, and the analytics rules (quality score, streaks, pattern normalization).
- [docs/development.md](docs/development.md) — prerequisites, setup, commands, and
  troubleshooting.
- [docs/phases/phase-01.md](docs/phases/phase-01.md) — the detailed record of Phase 1.
- [docs/phases/phase-02.md](docs/phases/phase-02.md) — the detailed record of Phase 2
  (LeetCode extraction).
- [docs/phases/phase-03.md](docs/phases/phase-03.md) — the detailed record of Phase 3
  (submission API).
- [docs/phases/phase-04.md](docs/phases/phase-04.md) — the detailed record of Phase 4
  (deterministic solution-analysis engine).
- [docs/phases/phase-05.md](docs/phases/phase-05.md) — the detailed record of Phase 5
  (AI-powered solution review), including a full example input/output.
- [docs/phases/phase-06.md](docs/phases/phase-06.md) — the detailed record of Phase 6
  (document generation), including a full example generated document.
- [docs/phases/phase-07.md](docs/phases/phase-07.md) — the detailed record of Phase 7
  (GitHub integration), including the complete publish workflow.
- [docs/phases/phase-08.md](docs/phases/phase-08.md) — the detailed record of Phase 8
  (dashboard, analytics, and PostgreSQL), including every file, the API, tests, and verification.
- [docs/phases/phase-09.md](docs/phases/phase-09.md) — the detailed record of Phase 9
  (improvement tracking), including every file, the API, tests, and verification.
- [docs/improvement-engine.md](docs/improvement-engine.md) — the improvement engine: data model,
  comparison logic, profile and recommendation logic, and limitations.
