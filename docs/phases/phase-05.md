# Phase 5 — AI-Powered Solution Review

## Objective

Add an AI-powered analysis layer that takes the LeetCode problem, the user's submitted
solution, and Phase 4's deterministic analysis, and produces a structured, schema-validated
expert-level review answering all 16 required questions — while never blindly trusting the AI:
the deterministic analysis, the AI analysis, and any disagreement between them are all
preserved and exposed, never silently merged or resolved. Document generation and GitHub
integration remain explicitly out of scope for this phase.

## Implementation Summary

- A new `apps/api/src/ai/` module: `prompts/`, `providers/`, `schemas/`, plus
  `ai-review.service.ts`, `agreement.ts`, `errors.ts`, and `types.ts` — HTTP-agnostic, callable
  from anywhere, with zero Express dependency.
- A provider abstraction (`AiProvider`) with one real implementation
  (`anthropicProvider.ts`, calling Anthropic's Messages API directly over `fetch`) and a
  test-only mock (`mockProvider.ts`, excluded from the production build).
- A dedicated prompt-building module (`prompts/reviewPrompt.ts`) — never a prompt string
  inlined in a controller or service.
- A strict Zod schema (`schemas/solutionReview.schema.ts`) every AI response must pass before
  it's trusted anywhere in the system.
- `agreement.ts`: compares the deterministic (Phase 4) and AI complexity/pattern claims and
  reports exactly where they match and where they don't — the direct implementation of the
  task's "expose the disagreement rather than hiding it" requirement.
- A typed error hierarchy (`AiReviewError`, five codes) covering every failure mode the task
  named: timeout, provider error, rate limit, malformed response, and schema validation
  (covering both "invalid response" and "missing fields").
- A new endpoint, `POST /api/submissions/:id/review`, wiring all of the above to HTTP —
  requiring `SubmissionRepository.findById` (new this phase) and a new `NotFoundError` class.
- **56 new tests** for this phase (repository +2, service +2, and the full `ai/` suite: schema,
  prompt, provider, service, agreement, plus a 9-case end-to-end HTTP integration test),
  bringing the API to 100 tests and the repo to **232 tests total**.

## Architecture

```
apps/api/src/
├── ai/
│   ├── prompts/
│   │   ├── reviewPrompt.ts
│   │   └── reviewPrompt.test.ts
│   ├── providers/
│   │   ├── types.ts
│   │   ├── anthropicProvider.ts
│   │   ├── anthropicProvider.test.ts
│   │   └── mockProvider.ts              (test/dev-only — excluded from the build)
│   ├── schemas/
│   │   ├── solutionReview.schema.ts
│   │   └── solutionReview.schema.test.ts
│   ├── agreement.ts
│   ├── agreement.test.ts
│   ├── errors.ts
│   ├── types.ts
│   ├── ai-review.service.ts
│   └── ai-review.service.test.ts
├── controllers/
│   └── reviews.controller.ts             (new)
├── routes/
│   ├── reviews.route.ts                   (new)
│   ├── reviews.route.test.ts                (new — full HTTP integration)
│   └── index.ts                              (modified — wires the review service + real provider)
├── repositories/
│   └── submissions.repository.ts           (modified — adds findById)
├── services/
│   └── submissions.service.ts               (modified — adds getSubmissionById)
├── types/
│   └── errors.ts                             (modified — adds NotFoundError)
└── app.ts                                     (modified — accepts a test-only aiProvider override)
```

### Request flow

```
POST /api/submissions/:id/review
  → reviews.controller.ts: look up the submission (404 if missing)
  → analyzeSolution() (packages/analysis, Phase 4) — recomputed fresh from the stored code
  → AiReviewService.generateReview(problem, submission, deterministicAnalysis)
      → prompts/reviewPrompt.ts builds the system + user prompt
      → the injected AiProvider.generate() calls the LLM (real: Anthropic; test: mocked)
      → strip markdown fences → JSON.parse → solutionReviewSchema.safeParse
      → returns a validated SolutionReview, or throws a typed AiReviewError
  → compareAnalyses(deterministic, ai) → ReviewAgreement
  → 200 { deterministic, ai, agreement, submissionId, generatedAt }
```

Any `AiReviewError` thrown anywhere in that chain is translated, in the controller, to the
HTTP-facing `ApiError` the centralized error handler (`middleware/errorHandler.ts`, unchanged
since Phase 3) already knows how to turn into a consistent JSON response.

## Every Important File — Why, What, Where Used, Dependencies

### `apps/api/src/ai/schemas/solutionReview.schema.ts`

**Why:** the AI's raw text output is untrusted, exactly like an HTTP request body is untrusted
— nothing downstream should ever see AI output that hasn't passed a strict, independent check.
**What:** a Zod schema for the 15-field `SolutionReview` shape (see
[docs/ai-analysis.md](../ai-analysis.md#structured-output) for the full field-by-field mapping
to the task's 16 questions); exports `SolutionReview` as `z.infer<typeof solutionReviewSchema>`.
**Where used:** `ai-review.service.ts` (validates every provider response);
`agreement.ts`/`ai/types.ts` (type only, for `ReviewAgreement`/`CombinedSolutionReview`).
**Depends on:** `zod` only.

### `apps/api/src/ai/providers/types.ts`

**Why:** the one interface `ai-review.service.ts` depends on, so the LLM vendor can be changed
without touching the service, prompts, or schema — the same dependency-inversion shape Phase 3
used for `SubmissionRepository`. **What:** `AiProviderRequest` (`systemPrompt`, `userPrompt`,
`maxOutputTokens`, `timeoutMs`), `AiProviderResponse` (`text`), and the `AiProvider` interface
itself. **Where used:** implemented by `anthropicProvider.ts` and `mockProvider.ts`; imported
by `ai-review.service.ts`, `app.ts`, and `routes/index.ts` (for the test-only override type).
**Depends on:** nothing.

### `apps/api/src/ai/providers/anthropicProvider.ts`

**Why:** the one real, production `AiProvider` implementation. **What:**
`createAnthropicProvider(config)` calls `POST {baseUrl}/v1/messages` with the Anthropic
Messages API request shape, using `AbortController` for `timeoutMs`, and maps HTTP responses to
`AiReviewError` codes: 429 → `RATE_LIMITED`; any other non-2xx → `PROVIDER_ERROR`; an aborted
request → `TIMEOUT`; a non-JSON or empty-text-content response → `MALFORMED_RESPONSE`; a
missing `apiKey` fails synchronously with `PROVIDER_ERROR` *before* any network call, so the
whole API process can start and serve every other endpoint fine with no key configured — only
this one endpoint fails, clearly, when actually hit. **Where used:** constructed once in
`routes/index.ts`, using `AI_PROVIDER_API_KEY`/`AI_PROVIDER_MODEL` from the environment.
**Depends on:** `../errors.js` (`AiReviewError`); the global `fetch`. **Never called with a
real network request anywhere in this repository** — see its own test file, which mocks
`fetch` entirely, and [docs/ai-analysis.md's Limitations](../ai-analysis.md#limitations) for
the explicit disclosure that this was never exercised against the live Anthropic API in this
environment.

### `apps/api/src/ai/providers/mockProvider.ts`

**Why:** the task's explicit "mock the AI provider; do not make real AI API calls in unit
tests" requirement, implemented once and reused everywhere instead of every test hand-rolling
its own fake. **What:** `createMockProvider(handler)` (arbitrary per-request logic),
`createFixedMockProvider(text)` (always returns the same text), `createFailingMockProvider(error)`
(always rejects). **Where used:** `ai-review.service.test.ts`, `reviews.route.test.ts`. **Not**
used by any production code path — `routes/index.ts` never imports it, and it's excluded from
`apps/api/tsconfig.build.json` so it doesn't even exist in the built `dist/` output. **Depends
on:** `./types.js` only.

### `apps/api/src/ai/prompts/reviewPrompt.ts`

**Why:** a dedicated prompt-building module instead of a prompt string inlined in a controller
or service — the task's explicit "do not hardcode one huge prompt inside the controller"
requirement. **What:** `buildReviewSystemPrompt()` (role, instructions, the full field list of
the expected JSON shape) and `buildReviewUserPrompt(input)` (renders the problem, code, and
Phase 4 findings into the actual prompt text, with length truncation — see
[docs/ai-analysis.md](../ai-analysis.md#bounding-size-and-cost)). `ReviewPromptInput` is typed
to accept only `{ problem, submission, deterministicAnalysis }` — never the full
`StoredSubmission` — which is what makes it structurally impossible to accidentally forward
`id`/`metadata` fields to the AI provider. **Where used:** `ai-review.service.ts`. **Depends
on:** `@codereviewai/shared` (`LeetCodeProblemInfo`/`LeetCodeSubmissionInfo`),
`@codereviewai/analysis` (`SolutionAnalysis`, type only).

### `apps/api/src/ai/agreement.ts`

**Why:** the direct implementation of the task's CRITICAL requirement — preserve both analyses
and expose disagreement rather than hiding it. **What:** `compareAnalyses(deterministic, ai)` →
`ReviewAgreement`, normalizing and comparing both complexity notations (lowercase, whitespace
stripped — a string match, not symbolic algebra) and both pattern lists (case-insensitive exact
match), producing `time`/`space` (`{ matches, deterministic, ai }`),
`patternsAgreedOn`/`patternsOnlyInDeterministic`/`patternsOnlyInAi`, and a top-level
`hasDisagreement` flag. **Where used:** `controllers/reviews.controller.ts`. **Depends on:**
`@codereviewai/analysis` (`SolutionAnalysis`, type only), `./schemas/solutionReview.schema.js`
(`SolutionReview`, type only).

### `apps/api/src/ai/errors.ts`

**Why:** one error type for every AI failure mode, decoupled from Express/HTTP (this file has
no concept of `res.status()`) — the controller is responsible for the HTTP translation. **What:**
`AiReviewErrorCode` (`TIMEOUT | PROVIDER_ERROR | RATE_LIMITED | MALFORMED_RESPONSE |
SCHEMA_VALIDATION_FAILED`) and the `AiReviewError` class. **Where used:** thrown by
`anthropicProvider.ts` and `ai-review.service.ts`; caught and translated by
`controllers/reviews.controller.ts`. **Depends on:** nothing (extends the built-in `Error`).

### `apps/api/src/ai/types.ts`

**Why:** the response shape for the new endpoint, deliberately keeping `deterministic` and `ai`
as two complete, separate objects rather than one merged "best guess." **What:**
`CombinedSolutionReview` (`submissionId`, `deterministic: SolutionAnalysis`, `ai:
SolutionReview`, `agreement: ReviewAgreement`, `generatedAt`). **Where used:**
`controllers/reviews.controller.ts` (constructs it), `routes/reviews.route.test.ts` (asserts
its shape). **Depends on:** `@codereviewai/analysis`, `./agreement.js`,
`./schemas/solutionReview.schema.js`.

### `apps/api/src/ai/ai-review.service.ts`

**Why:** the one orchestrator tying prompt-building, the provider call, and response validation
together — this is what every other layer (the controller, tests) actually calls. **What:**
`AiReviewService` class, constructor-injected with an `AiProvider` (never a concrete class) and
an optional `{ maxOutputTokens, timeoutMs }` config (defaults: 4096 tokens, 30s).
`generateReview(input)`: builds the prompt, calls the provider through a `Promise.race` against
its own timeout (defense-in-depth even if a provider doesn't honor `timeoutMs` itself), strips
markdown fences, parses JSON, validates against `solutionReviewSchema`, and returns a
`SolutionReview` — or throws an `AiReviewError`. **Guarantees every thrown error is an
`AiReviewError`**, wrapping anything else a misbehaving provider might throw into
`PROVIDER_ERROR`. **Where used:** constructed in `routes/index.ts`; called by
`controllers/reviews.controller.ts`. **Depends on:** `./errors.js`, `./prompts/reviewPrompt.js`,
`./providers/types.js`, `./schemas/solutionReview.schema.js`.

### `apps/api/src/controllers/reviews.controller.ts`

**Why:** the one place `ai/`'s HTTP-agnostic types meet Express. **What:**
`createReviewsController({ submissionService, reviewService })` (factory, matching
`submissions.controller.ts`'s shape) → `generateReview` handler: looks up the submission (404
via `NotFoundError` if missing), guards the theoretically-nullable-but-never-actually-null
`submission.code` field explicitly (documented inline — a stored submission's code can never
really be `null`, since Phase 3's schema requires it, but the shared `LeetCodeSubmissionInfo`
type doesn't encode that guarantee, so this is a deliberate, visible assertion rather than an
implicit one), runs `analyzeSolution()` fresh, calls the AI service, compares the two analyses,
and responds `200` with a `CombinedSolutionReview` — or forwards a translated `ApiError` to
`next()`. **Where used:** wired into `routes/reviews.route.ts` from `routes/index.ts`.
**Depends on:** `@codereviewai/analysis`, `@codereviewai/shared`, `../ai/agreement.js`,
`../ai/ai-review.service.js`, `../ai/errors.js`, `../ai/types.js`,
`../services/submissions.service.js`, `../types/errors.js`.

### `apps/api/src/routes/reviews.route.ts`

**Why/what:** mounts `POST /submissions/:id/review` (under `/api`, from `app.ts`) to the
reviews controller — kept as its own router file (rather than added to
`submissions.route.ts`) so the AI-review-specific route is as separable as the rest of `ai/`.
**Where used:** composed into `createApiRouter()` in `routes/index.ts`.

### `apps/api/src/repositories/submissions.repository.ts` (modified)

**Why:** Phase 5 is the first phase with an actual read path — the review endpoint needs to
look a submission up by id. Phase 3's version of this file predicted exactly this: "read
methods get added to the interface in the phase that actually needs them." **What added:**
`findById(id): Promise<StoredSubmission | null>` on both the `SubmissionRepository` interface
and `InMemorySubmissionRepository`. **Where used:**
`services/submissions.service.ts`'s new `getSubmissionById`.

### `apps/api/src/services/submissions.service.ts` (modified)

**What added:** `getSubmissionById(id)`, a thin pass-through to
`repository.findById(id)` — kept as a service method (not called directly from the controller)
to preserve the existing controller → service → repository layering. **Where used:**
`controllers/reviews.controller.ts`.

### `apps/api/src/types/errors.ts` (modified)

**What added:** `NotFoundError extends ApiError` (`404`, code `NOT_FOUND`) — the first new
`ApiError` subclass since Phase 3, which predicted this exact addition for "when read endpoints
exist." **Where used:** `controllers/reviews.controller.ts`, thrown when a submission id isn't
found.

### `apps/api/src/routes/index.ts` (modified)

**What changed:** now also constructs the real `AiProvider`
(`createAnthropicProvider({ apiKey: process.env.AI_PROVIDER_API_KEY, model:
process.env.AI_PROVIDER_MODEL ?? 'claude-sonnet-5' })`), the `AiReviewService`, and the reviews
controller/router — unless a test passes an `aiProvider` override through `ApiRouterDeps`, in
which case that's used instead (see `app.ts` below). This is what makes `npm run dev`/`npm start`
call the real provider while every test calls a mock, without any test needing to touch
environment variables.

### `apps/api/src/app.ts` (modified)

**What changed:** `AppConfig` gained an optional `aiProvider?: AiProvider` field, threaded
through to `createApiRouter()`. Production code (`src/index.ts`) never sets it, so it always
gets the real provider; every test that needs the review endpoint calls
`createApp({ corsOrigin, aiProvider: createFixedMockProvider(...) })` instead.

## Example Input/Output

Given a stored submission for Two Sum with this code:

```js
var twoSum = function (nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
};
```

`POST /api/submissions/<id>/review` (no request body — the code comes from the stored
submission) returns:

```json
{
  "success": true,
  "data": {
    "submissionId": "9869e5e2-e9a1-45d1-ba86-4b1a4ca383bf",
    "deterministic": {
      "detectedLanguage": "JavaScript",
      "detectedPatterns": [
        { "pattern": "Hash Map", "confidence": { "level": "high", "score": 0.8, "reason": "2 of 8 signal(s) matched (score 0.80)." }, "evidence": ["constructs a `new Map(`", "uses map-style `.get(`/`.set(`/`.has(` calls"] }
      ],
      "estimatedTimeComplexity": { "notation": "O(n)", "confidence": { "level": "high", "score": 0.75, "reason": "..." }, "reasoning": ["A single, non-nested loop was found.", "Hash-based lookups were also found, keeping per-element work close to O(1)."] },
      "estimatedSpaceComplexity": { "notation": "O(n)", "confidence": { "level": "medium", "score": 0.55, "reason": "..." }, "reasoning": ["A hash map/set was detected — up to O(n) auxiliary space if it grows with the input."] },
      "algorithmCharacteristics": { "usesRecursion": false, "usesIteration": true, "maxLoopNestingDepth": 1, "usesSorting": false, "usesHashing": true, "usesExtraLinearStructure": true },
      "possibleIssues": [],
      "codeQualityObservations": [],
      "edgeCaseObservations": [{ "concern": "Empty input", "detail": "The code loops over its input but no explicit empty-input check...", "severity": "info" }],
      "confidence": { "level": "high", "score": 0.7, "reason": "Averaged across 1 detected pattern(s) plus the time and space complexity estimates." }
    },
    "ai": {
      "problemSummary": "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
      "userApproach": "Single-pass hash map lookup: for each number, check whether its complement was already seen.",
      "patterns": ["Hash Map"],
      "whyItWorks": "Every element is visited once; checking and inserting into the hash map are both O(1) on average, so any valid pair is found the first time its complement is encountered.",
      "complexity": { "time": "O(n)", "space": "O(n)" },
      "strengths": ["Single pass, no nested loops", "Early return as soon as a pair is found"],
      "improvements": ["Add an explicit comment noting the assumption of exactly one valid answer, per the problem statement"],
      "correctnessConcerns": [],
      "edgeCases": ["An input array shorter than length 2 is not explicitly handled, though the loop naturally returns an empty array in that case"],
      "optimality": { "isOptimal": true, "reasoning": "O(n) time is optimal — any correct solution must inspect every element at least once." },
      "betterApproach": null,
      "alternativeApproaches": ["Sort the array and use two pointers — O(n log n) time, O(1) extra space (ignoring the sort's own space), trading time for space"],
      "learningPoints": ["A hash map turns an O(n^2) brute-force pair search into O(n) by trading space for time — recognizing this trade-off is broadly reusable."],
      "relatedPatterns": ["Two Pointers", "Sliding Window"],
      "confidence": "high"
    },
    "agreement": {
      "time": { "matches": true, "deterministic": "O(n)", "ai": "O(n)" },
      "space": { "matches": true, "deterministic": "O(n)", "ai": "O(n)" },
      "patternsAgreedOn": ["Hash Map"],
      "patternsOnlyInDeterministic": [],
      "patternsOnlyInAi": [],
      "hasDisagreement": false
    },
    "generatedAt": "2026-09-16T18:05:30.001Z"
  }
}
```

(The `ai` block above is a realistic example of what a well-behaved model would return — it was
constructed by hand for this document, not captured from a real API call; see
[docs/ai-analysis.md's Limitations](../ai-analysis.md#limitations) for why no real call was made
in this environment. The `deterministic` block *is* real, actual output from Phase 4's engine
against the exact code shown above.)

**A disagreement example** — the same endpoint, for code with two nested loops, where a
(mocked, in the test suite) AI response claims `O(n)`:

```json
{
  "deterministic": { "estimatedTimeComplexity": { "notation": "O(n^2)", "...": "..." } },
  "ai": { "complexity": { "time": "O(n)", "space": "O(1)" }, "...": "..." },
  "agreement": {
    "time": { "matches": false, "deterministic": "O(n^2)", "ai": "O(n)" },
    "hasDisagreement": true
  }
}
```

This exact scenario is a real, passing test —
`routes/reviews.route.test.ts`'s *"exposes a time-complexity disagreement rather than hiding
it"* — not a hypothetical.

## Testing

56 new tests across 8 files:

- **`schemas/solutionReview.schema.test.ts`** (15 tests) — valid payload accepted; every
  required field's absence rejected (looped over the field list); `learningPoints` must be
  non-empty; wrong types rejected (`patterns` as a string); unknown `confidence` value
  rejected; nested object field omissions rejected (`complexity` missing `space`,
  `betterApproach` missing `whyBetter`); completely wrong top-level shapes (array, string,
  `null`) rejected; empty-string required fields rejected.
- **`prompts/reviewPrompt.test.ts`** (11 tests) — the system prompt lists every schema field and
  states the deterministic analysis can be wrong; the user prompt includes the problem, code,
  and every deterministic finding; **never includes submission metadata** (asserted both by the
  input type's shape and by a regex check on the rendered text); renders `"Unavailable"` for
  null fields; truncates an overlong description/code; renders `"(none detected)"` when no
  patterns were found.
- **`providers/anthropicProvider.test.ts`** (10 tests) — fails synchronously with no network
  call when no API key is configured; parses a successful response's concatenated text content;
  sends the exact expected request shape (URL, headers, model, `max_tokens`, system/user
  messages) to a mocked `fetch`; maps HTTP 429 to `RATE_LIMITED`; other non-2xx to
  `PROVIDER_ERROR`; a rejected `fetch` (network failure) to `PROVIDER_ERROR`; an aborted request
  (simulated via a mocked `fetch` that listens to the abort signal) to `TIMEOUT`; a non-JSON or
  empty-content response to `MALFORMED_RESPONSE`; every rejection is an `AiReviewError`
  instance.
- **`ai-review.service.test.ts`** (11 tests) — a well-formed response parses correctly; a
  ` ```json ` -fenced response still parses; the prompt actually receives the problem/code/
  analysis; a non-JSON response → `MALFORMED_RESPONSE`; a missing required field, a wrong type,
  and an invalid enum value each → `SCHEMA_VALIDATION_FAILED`; a provider-raised `AiReviewError`
  (e.g. `RATE_LIMITED`) propagates unchanged; a non-`AiReviewError` thrown by the provider is
  wrapped into `PROVIDER_ERROR`; a provider that never resolves → `TIMEOUT` after the configured
  delay; every rejection is an `AiReviewError` instance.
- **`agreement.test.ts`** (9 tests) — full agreement (matching complexity and patterns);
  whitespace-insensitive complexity matching (`"O(n log n)"` vs `"O(nlogn)"`); **the task's own
  `O(n)` vs `O(n^2)` disagreement example**; an independent space-complexity disagreement; a
  pattern the AI found that static analysis missed, and vice versa; case-insensitive pattern
  matching; disagreement correctly flagged when the deterministic side is itself `"Unknown"`.
- **`repositories/submissions.repository.test.ts`** (+2 tests) — `findById` returns a
  previously created submission; returns `null` (not a throw) for an unknown id.
- **`services/submissions.service.test.ts`** (+2 tests) — `getSubmissionById` round-trips
  through the repository; returns `null` for an unknown id.
- **`routes/reviews.route.test.ts`** (9 tests, full HTTP integration via Supertest) — a full
  create-submission-then-review round trip returns 200 with all three parts of
  `CombinedSolutionReview` correctly populated; **the disagreement scenario end-to-end** (real
  nested-loop code, a mocked AI claiming `O(n)`, asserting the response's `agreement.hasDisagreement`
  is `true`); an unknown submission id → 404 `NOT_FOUND`; and one test per `AiReviewError` code
  → the correct HTTP status and `ApiError` code (`TIMEOUT`→504, `RATE_LIMITED`→429,
  `MALFORMED_RESPONSE`→502, `SCHEMA_VALIDATION_FAILED`→502, `PROVIDER_ERROR`→502).

**No test in this repository ever calls a real AI provider or makes a real network request to
an LLM API** — every AI-facing test uses `providers/mockProvider.ts` or a mocked `global.fetch`.

## Commands

```bash
npm install                                   # picks up the ai/ module's new zod usage (already a dependency)
npm run typecheck                             # all 5 workspaces
npm run test                                  # all 5 workspaces (232 tests total)
npm run test -w @codereviewai/api              # just the API (100 tests, 56 new this phase)
npm run lint
npm run format
npm run build                                  # confirms mockProvider.ts is excluded from dist/
```

## Verification

Performed against this repository as part of completing Phase 5:

1. `npm install` — succeeds, 0 vulnerabilities.
2. `npm run typecheck` — passes in all 5 workspaces.
3. `npm run test` — 232/232 tests pass repo-wide (100 in `apps/api`, 56 of them new this
   phase).
4. `npm run lint` — 0 errors, 0 warnings.
5. `npm run format:check` — all files match Prettier style.
6. `npm run build` — all 5 packages build; confirmed `apps/api/dist/ai/` contains every
   production `ai/` file **except** `providers/mockProvider.js` (explicitly excluded via
   `apps/api/tsconfig.build.json`); confirmed no `*.test.*` files leak into any `dist/` output.
7. Started the **production** API build (`node dist/index.js`, no `AI_PROVIDER_API_KEY` set)
   and, via `curl`: confirmed `GET /api/health` and `POST /api/submissions` still work
   unchanged; confirmed `POST /api/submissions/:id/review` fails with a clear
   `502 AI_PROVIDER_ERROR` ("AI provider is not configured...") **instead of crashing the
   process** — and confirmed the server was still healthy and responsive immediately
   afterward.
8. Stopped all background dev/start processes after verification; confirmed no stray process
   left listening on port 4000.

**Not performed:** an actual, real call to the Anthropic API — no API key was available (or
appropriate to use, given real cost) in this environment. See
[docs/ai-analysis.md's Limitations](../ai-analysis.md#limitations).

## Limitations

See [docs/ai-analysis.md](../ai-analysis.md#limitations) for the full list (no execution-based
verification, string-based agreement comparison, the untested-against-live-API disclosure, no
retry logic, no caching). Specific to this phase's scope:

- Document generation and GitHub integration remain unimplemented, as explicitly required.
- The extension and web frontend have no UI for triggering a review yet — the endpoint exists
  and is fully tested, but nothing outside `apps/api` calls it. This mirrors Phase 4's own
  "built, tested, not yet wired into a UI" scoping.
- `possibleIssues` (Phase 4's synthesized digest) is not currently included anywhere in
  `CombinedSolutionReview` — a future phase could add it back in alongside the AI review for a
  single combined "what to check first" list spanning both analyses.

## What Phase 6 Will Implement

Per the roadmap in the README, Phase 6 introduces learning-document generation (rendering a
`CombinedSolutionReview` into a structured Markdown document) alongside real, persistent storage
(a database implementing the existing `SubmissionRepository` interface, replacing
`InMemorySubmissionRepository` — Phase 3 and Phase 5 both already depend only on that
interface, so this swap should touch no business logic in either phase's code). Persistence is
also the point where storing a *generated review* (not just the raw submission) becomes
relevant — this phase's `CombinedSolutionReview` is currently computed fresh on every request
and never saved.
