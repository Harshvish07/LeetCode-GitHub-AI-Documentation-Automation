# AI Analysis

This document explains the AI-powered review layer added in Phase 5: how it's architected, how
its output is validated, how it relates to Phase 4's deterministic analysis, and its privacy and
cost posture. For the endpoint's request/response shape, see
[docs/api.md](api.md#post-apisubmissionsidreview). For the full phase record (every file, why
it exists, exact test coverage), see [docs/phases/phase-05.md](phases/phase-05.md).

## AI architecture

```
apps/api/src/ai/
├── prompts/
│   └── reviewPrompt.ts       Builds the system + user prompt from problem/submission/analysis
├── providers/
│   ├── types.ts                     The AiProvider interface — the only thing the service depends on
│   ├── anthropicProvider.ts          Real implementation calling Anthropic's Messages API
│   ├── geminiProvider.ts             Real implementation calling Google's Gemini generateContent API
│   ├── createProviderFromEnv.ts      Picks anthropic|gemini from AI_PROVIDER and configures it
│   └── mockProvider.ts               Test/dev-only fakes — never wired into the real app
├── schemas/
│   └── solutionReview.schema.ts  The Zod schema every AI response must pass before it's trusted
├── agreement.ts                Compares deterministic vs AI complexity/pattern claims
├── errors.ts                    AiReviewError — one error type for every AI failure mode
├── types.ts                      CombinedSolutionReview — the endpoint's response shape
└── ai-review.service.ts           The orchestrator: prompt → provider → parse → validate
```

Nothing in `ai/` imports Express — the whole module is HTTP-agnostic, callable from a route
handler, a script, or a future job queue with no change. `controllers/reviews.controller.ts` is
the one place that wires it to HTTP: it loads a stored submission, runs Phase 4's
`analyzeSolution()`, calls `AiReviewService.generateReview()`, compares the two analyses via
`compareAnalyses()`, and returns all three together as one `CombinedSolutionReview`.

### Provider abstraction

`AiReviewService` depends on the `AiProvider` interface (`providers/types.ts`) — a single
`generate({ systemPrompt, userPrompt, maxOutputTokens, timeoutMs }) → { text }` method — never on
a concrete provider class. Two real implementations exist: `providers/anthropicProvider.ts`
(Anthropic's Messages API) and `providers/geminiProvider.ts` (Google's Gemini `generateContent`
API), both calling their vendor's HTTP API directly over `fetch` (no SDK dependency for one HTTP
call each). `providers/createProviderFromEnv.ts` is the single place that reads `AI_PROVIDER`
(`"anthropic"` | `"gemini"`, defaulting to `"anthropic"`) and `AI_PROVIDER_API_KEY`/
`AI_PROVIDER_MODEL` and constructs the selected one — nothing else in `ai/` ever branches on which
vendor is active. Adding a third vendor is a new file implementing the same interface plus one
more `case` in `createProviderFromEnv.ts`; nothing in the prompt layer, the schema, the service,
or the controller would need to change. This is deliberately the same dependency-inversion shape
Phase 3 used for `SubmissionRepository` (services depend on an interface, never a concrete class).

`providers/mockProvider.ts` exists purely for tests (`createFixedMockProvider`,
`createFailingMockProvider`, `createMockProvider`) and is explicitly excluded from the production
build (`apps/api/tsconfig.build.json`) — it is never reachable from the running server.

## Prompt architecture

The prompt is built in two parts, kept in one dedicated file
(`prompts/reviewPrompt.ts`) rather than inlined in the controller or the service, so the prompt
can be read, tested, and changed independently of everything else:

- **`buildReviewSystemPrompt()`** — a fixed string establishing the AI's role ("expert data
  structures and algorithms interviewer"), instructing it to form its own independent judgment
  rather than just restating the deterministic analysis, and — critically for structured output
  — listing every field of the response schema by name with its type and meaning, and demanding
  the response be *only* a JSON object with no markdown fences or commentary.
- **`buildReviewUserPrompt(input)`** — renders the actual problem, submitted code, and a summary
  of Phase 4's deterministic findings (detected patterns, complexity estimates, code-quality and
  edge-case observations) into a structured, labeled text block.

Both are pure functions with no I/O, so they're unit-tested directly
(`prompts/reviewPrompt.test.ts`) without ever calling a real provider.

### Bounding size and cost

The user prompt truncates the problem description at 2,000 characters and the submitted code at
8,000 characters (`MAX_DESCRIPTION_LENGTH`/`MAX_CODE_LENGTH` in `reviewPrompt.ts`), appending
`(truncated)` when it does. Neither bound affects the vast majority of real LeetCode
problems/solutions — they exist specifically to cap token cost against pathological inputs,
documented explicitly rather than left as an implicit accident of some other limit.

## Structured output

The AI is asked for JSON matching a 15-field `SolutionReview` shape, directly answering all 16
questions the task specifies (two questions collapse into one `optimality`/`betterApproach` pair
— see the table below):

| Task question | `SolutionReview` field |
| --- | --- |
| 1. What approach did I use? | `userApproach` |
| 2. Which DSA pattern did I use? | `patterns` |
| 3. Why does my solution work? | `whyItWorks` |
| 4. What is my time complexity? | `complexity.time` |
| 5. What is my space complexity? | `complexity.space` |
| 6. What did I do well? | `strengths` |
| 7. What can be improved? | `improvements` |
| 8. Are there correctness concerns? | `correctnessConcerns` |
| 9. Are there edge cases I missed? | `edgeCases` |
| 10. Is the solution optimal? | `optimality.isOptimal` (+ `.reasoning`) |
| 11. Is there a better approach? | `betterApproach !== null` |
| 12. What is the better approach? | `betterApproach.description` |
| 13. What is its complexity? | `betterApproach.complexity` |
| 14. Why is it better? | `betterApproach.whyBetter` |
| 15. What should I learn? | `learningPoints` |
| 16. What related patterns should I practice? | `relatedPatterns` |

Plus `problemSummary` (grounds the review in the AI's own understanding of the problem, useful
for catching a misread problem) and `confidence` (the AI's own self-reported confidence — see
[Deterministic vs AI analysis](#deterministic-vs-ai-analysis) for why this is not blindly
trusted either).

## Validation

**The raw text an AI provider returns is untrusted output, exactly like a client's HTTP request
body is untrusted input** — this is the same posture Phase 3 takes toward `POST
/api/submissions`, applied to the opposite direction of the request. `schemas/solutionReview.schema.ts`
is a Zod schema independent of whatever the prompt *asked* for; nothing downstream ever sees an
AI response that hasn't passed it. Validation happens in three steps inside
`ai-review.service.ts`:

1. **Strip markdown fences.** LLMs frequently wrap JSON in ` ```json ... ``` ` even when
   explicitly told not to — `stripMarkdownFences()` recognizes and removes a single wrapping
   fence before attempting to parse.
2. **Parse as JSON.** If this fails, the error is `MALFORMED_RESPONSE` — the model didn't
   produce anything JSON-shaped at all.
3. **Validate against `solutionReviewSchema`.** If this fails — a missing required field, a
   wrong type, an enum value outside `{low, medium, high}` — the error is
   `SCHEMA_VALIDATION_FAILED`, with a human-readable summary of every failing field attached.

Only a response that survives all three steps ever becomes a `SolutionReview` object anywhere
else in the system.

## Deterministic vs AI analysis

**The system never merges the two analyses into one "best guess."** Every response from `POST
/api/submissions/:id/review` (`CombinedSolutionReview`, `ai/types.ts`) contains three things
side by side:

- `deterministic` — Phase 4's `SolutionAnalysis`, unchanged, recomputed fresh from the stored
  code on every request.
- `ai` — the schema-validated `SolutionReview`.
- `agreement` — the output of `compareAnalyses()` (`ai/agreement.ts`), which normalizes and
  compares the two complexity estimates and the two pattern lists, and reports exactly where
  they match and where they don't.

This is the direct implementation of the task's explicit requirement: *"If AI says O(n) but
deterministic analysis estimates O(n²), expose the disagreement rather than hiding it."*
`agreement.time.matches` would be `false` in exactly that case, and `agreement.hasDisagreement`
would be `true` — nothing in the pipeline resolves the conflict in either direction; it's
surfaced as data for the caller to see. The comparison is a normalized **string** match
(lowercase, whitespace stripped) — `"O(n log n)"` and `"O(nlogn)"` are treated as equal, `"O(n)"`
and `"O(n^2)"` are not — a deliberately simple heuristic, not a computer-algebra system.

## Hallucination mitigation

Several independent, layered defenses — none of them alone sufficient, which is the point:

1. **Structured-output validation** (above) rejects a response that doesn't even have the right
   shape, catching the most obvious failure mode outright.
2. **The system prompt explicitly tells the model the deterministic analysis can be wrong** and
   to form its own judgment rather than just echoing it — this cuts both directions: it
   discourages the AI from uncritically trusting a wrong heuristic result, and (by grounding the
   AI in objectively-computed signals) discourages it from inventing patterns/complexity out of
   nothing.
3. **Disagreement is surfaced, never silently resolved** (above) — a hallucinated complexity
   claim doesn't get to quietly overwrite or hide behind the deterministic one; both are always
   visible.
4. **The AI reports its own `confidence`** — but this is treated as one more untrusted claim,
   not ground truth. A model expressing "high" confidence in a wrong answer is a real,
   well-documented failure mode of LLMs; nothing in this system special-cases
   `confidence: "high"` to skip any of the checks above.
5. **`possibleIssues`-style synthesis is deliberately left to Phase 4's deterministic engine,
   not the AI** — the AI's structured fields stay close to what only a language model can
   usefully add (explanation, comparison, teaching) rather than being asked to re-derive
   objective facts (loop nesting, pattern signals) a text heuristic already computed more
   reliably.

What this system does **not** do, and should not be assumed to do: verify the AI's claims
against actual code execution, cross-check `whyItWorks`/`correctnessConcerns` against a real
test suite, or catch a plausible-sounding but factually wrong explanation that happens to be
internally consistent and schema-valid. Structured-output validation guarantees *shape*, never
*truth*.

## Limitations

- **No execution-based verification anywhere in this phase.** Neither the deterministic engine
  (Phase 4) nor the AI review actually runs the submitted code — both are static/textual
  analysis. A hallucinated `whyItWorks` explanation that is internally consistent and
  schema-valid will pass every check in this system.
- **Agreement comparison is a normalized string match, not a symbolic one.** `"O(n + m)"` vs
  `"O(m + n)"` would currently be flagged as disagreeing, even though they're mathematically
  identical — documented as an accepted heuristic limitation, the same spirit as Phase 4's own
  complexity estimator being explicitly non-authoritative.
- **Pattern-name agreement is also string-based** (case-insensitive exact match after
  trimming) — the AI saying "Hashing" when the deterministic engine says "Hash Map" would be
  reported as a disagreement even though a human would consider them the same idea.
- **The real Anthropic provider was never exercised against the live API in this environment** —
  no Anthropic API key has been available here, so `providers/anthropicProvider.ts`'s
  request-building and response-parsing logic is thoroughly unit-tested against a mocked
  `fetch`, but has not been confirmed against Anthropic's actual, live response format. This is
  the same category of honesty disclosure as Phase 2's "selectors were never verified against
  the live LeetCode site."
- **The Gemini provider *was* exercised against the live API once, manually, outside the
  automated test suite** — a real `POST /api/submissions/:id/review` call against
  `AI_PROVIDER=gemini` with a real key returned a well-formed, schema-valid review, including a
  genuine deterministic-vs-AI pattern disagreement (`hasDisagreement: true`) surfaced correctly
  rather than hidden. This confirms `providers/geminiProvider.ts`'s request/response parsing
  against the real Gemini response shape, but it was one ad hoc manual check, not a repeatable
  or automated one — every test in the suite (including `geminiProvider.test.ts`) still uses a
  mocked `fetch`, per the task's explicit requirement never to make real AI calls in tests.
- **No retry logic.** A `RATE_LIMITED` or transient `PROVIDER_ERROR` surfaces immediately as an
  API error rather than being retried with backoff — a reasonable next improvement, not
  implemented this phase.
- **One review per request; no caching.** Calling the endpoint twice for the same submission
  calls the AI provider twice, at full cost, with no deduplication.

## Privacy

- **The AI request contains exactly three things**: the problem (title, difficulty,
  description, URL), the submitted code and language, and Phase 4's deterministic analysis of
  that code. `ReviewPromptInput` (`prompts/reviewPrompt.ts`) is typed to accept nothing else —
  it is not possible to accidentally pass the full `StoredSubmission` through it.
- **`metadata.receivedAt`, `metadata.extractedAt`, `metadata.source`, and the submission's own
  `id` are never sent to the AI provider.** None of them would improve the review's quality, so
  none of them are forwarded — directly satisfying the task's "do not send unnecessary personal
  information."
- **Today's data model has no user-identifying information at all** — no account, no email, no
  IP address stored anywhere (authentication is not scheduled in any phase yet). The
  discipline of only forwarding exactly what's needed is deliberate scaffolding for that future
  phase, not a response to a current, real risk.
- **The API key never reaches the browser, the extension, or the frontend.** `AI_PROVIDER_API_KEY`
  is read once, server-side, in `providers/createProviderFromEnv.ts` (called from
  `routes/index.ts`) when constructing whichever real provider is selected — it is never
  included in any HTTP response, never serialized into `CombinedSolutionReview`, and nothing in
  `apps/web` or `apps/extension` has any code path that could read it (neither app has network
  access to the provider, nor to the API's environment variables).

## Cost considerations

- **Every AI call is triggered explicitly** — one call per `POST /api/submissions/:id/review`
  request, initiated only by a user action, never a background/automatic process.
- **`maxOutputTokens` is capped** (4096 by default, `AiReviewServiceConfig`) — bounds the
  response size, and therefore cost, of every single call.
- **Prompt truncation** (see [Prompt architecture](#bounding-size-and-cost)) bounds input token
  cost against unusually long problem descriptions or submissions.
- **No retries and no caching** (see [Limitations](#limitations)) means cost is predictable —
  exactly one provider call per endpoint call — but also means a flaky failure isn't
  automatically retried, and repeated review requests for the same submission are not
  deduplicated. Both would be reasonable, cost-relevant additions for a later phase.
- **The vendor and model are both configurable by env var alone** — `AI_PROVIDER`
  (`"anthropic"` | `"gemini"`, defaulting to `"anthropic"`) picks the vendor, and
  `AI_PROVIDER_MODEL` picks the model within it (defaulting to `claude-sonnet-5` for Anthropic
  or `gemini-3.6-flash` for Gemini) — no code change needed to trade cost against review
  quality, or to switch vendors entirely.
