# Phase 2 — LeetCode Extraction

## 1. Objective

Build the Chrome Extension so that, when the user is on a LeetCode problem page, the extension
can identify and collect the relevant problem and submission information: title, URL, slug,
problem number, difficulty, description, selected language, submitted code, submission status,
runtime, and memory — each returned as `null` (surfaced as "Unavailable" in the UI) rather than
guessed, whenever it can't be found reliably. The extraction logic must be modular and isolated
from the rest of the application, since LeetCode's DOM is not a stable public contract. No AI,
GitHub integration, authentication, database, or final dashboard belong to this phase.

## 2. What Was Implemented

- A dedicated LeetCode extraction adapter, `apps/extension/src/content/leetcode/` — five
  modules (`url.ts`, `selectors.ts`, `extractor.ts`, `parser.ts`, `types.ts`) plus the
  content-script entry point (`index.ts`) that wires it to the real browser.
- A new shared domain type, `LeetCodeExtraction` (and its nested types), added to
  `packages/shared` so the extension, and a later phase's API, agree on one contract.
- A real popup UI: a formatted summary (Problem / Difficulty / Language / Submission / Runtime
  / Memory) plus **Extract Problem** and **Analyze Solution** buttons — the latter shows the
  full raw extraction as pretty-printed JSON for debugging, with no AI call.
- A request/response message contract (`apps/extension/src/lib/messaging.ts`) connecting the
  popup to the content script via `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`.
- `manifest.json` updated to declare the content script, scoped to
  `https://leetcode.com/problems/*`, with **no** new `permissions`/`host_permissions` (static
  content-script matching doesn't require it).
- The esbuild build script updated with a third bundle entry point
  (`content/leetcode.js`).
- 44 new unit/integration tests (jsdom-based) covering URL detection, slug/title/difficulty/
  language/status/code/runtime/memory extraction, numbered-title parsing, and — explicitly —
  that missing fields come back `null` rather than a guess.

## 3. Extension Architecture

```
apps/extension/src/
├── background/service-worker.ts   (unchanged from Phase 1)
├── content/
│   └── leetcode/                  (new — see §4)
│       ├── url.ts
│       ├── selectors.ts
│       ├── extractor.ts
│       ├── parser.ts
│       ├── types.ts
│       └── index.ts               (the actual injected content script)
├── lib/
│   └── messaging.ts               (extended: popup ↔ content-script message contract)
└── popup/
    ├── popup.html                 (rewritten: real fields + two buttons + debug panel)
    ├── popup.ts                   (rewritten: drives extraction via messaging)
    └── popup.css                  (updated layout)
```

The popup never touches the LeetCode page directly — it can't; MV3 popups run in their own
isolated context. It asks the active tab's content script for data via
`chrome.tabs.sendMessage`, and the content script (injected only into
`leetcode.com/problems/*` pages, per `manifest.json`) is the only code that ever calls
`document.querySelector`/`window.location`. The background service worker is untouched by this
phase — extraction is a direct popup ↔ content-script conversation; there's no reason to route
it through the background worker in Phase 2, since nothing needs to happen when the popup isn't
open.

## 4. LeetCode Extraction Architecture

The core design constraint stated in the task brief — "do not assume LeetCode's DOM structure
is permanent" — shaped everything here. The adapter has five layers, each with one job:

```
url.ts        → pure string/regex parsing of the page URL (no DOM at all)
selectors.ts  → every CSS selector + text whitelist, isolated in one file
extractor.ts  → low-level DOM-reading primitives, one function per extraction strategy
parser.ts     → orchestrator: combines the above into one typed LeetCodeExtraction
index.ts      → the actual content-script entry point (the only file that touches
                 the real `document`/`window`)
```

Two extraction **strategies** are used, chosen per field by how safe it is:

1. **Exact-text whitelist matching** (difficulty, language, submission status) — try the
   curated selector containers first; if nothing matches, fall back to scanning *every leaf
   element in the whole document* for one whose entire trimmed text exactly equals a known
   value (`Easy`/`Medium`/`Hard`, a language name, a submission status). This is the **primary**
   strategy, not a last resort: it's far more resilient to markup drift than any guessed
   selector, and it doesn't false-positive on prose because a paragraph of problem-description
   text is never itself a leaf element whose only content is literally the word "Easy".
2. **Scoped regex matching** (runtime, memory) — only searches inside an already-matched result
   container, never the whole document, because a substring pattern like `\d+\s?ms` has real
   false-positive potential against arbitrary page text (constraint text mentioning numbers,
   etc.). If no result container is found, both fields are `null` — there is no whole-document
   fallback for this strategy, unlike the whitelist one.

A third, narrower technique — **direct selector query with a stable non-DOM fallback** — is
used for title (`document.title`, stripping the `" - LeetCode"` suffix) and description (a
`<meta name="description">` tag), since both have a reliable value outside the volatile
rendered page structure.

Submitted-code extraction is the one function documented as **best-effort only**
(`extractVisibleEditorCode`): it joins whatever `.view-line` elements LeetCode's Monaco editor
currently has rendered, in DOM order. This is a known, accepted limitation — see §14.

## 5–7. Every File Created/Modified — Why, and Where Used

### `packages/shared/src/types/leetcode.ts` (new)

**Why it exists:** the extraction result needs one canonical, typed shape that the extension
produces and that a later phase's API will consume — putting it in `shared` rather than
`apps/extension` avoids type drift when that phase arrives. **Contents:** `LeetCodeDifficulty`,
`LEETCODE_SUBMISSION_STATUSES` (a `const` array, also the source of truth for the status
whitelist used by extraction), `LeetCodeSubmissionStatus`, `LeetCodeProblemInfo`,
`LeetCodeSubmissionInfo`, `LeetCodeExtraction`. **Where used:** re-exported by
`apps/extension/src/content/leetcode/types.ts`; consumed by `extractor.ts`, `parser.ts`,
`popup.ts`, and `lib/messaging.ts`. **What Phase 3 will modify:** the API will likely add a
request/storage type that wraps `LeetCodeExtraction` (e.g. with a user/submission ID), but
`LeetCodeExtraction` itself should stay stable as the extraction contract.

### `packages/shared/src/index.ts` (modified)

Re-exports the new LeetCode types/const alongside the existing `api.ts` exports — no other
changes to this file's existing exports.

### `apps/extension/src/content/leetcode/url.ts` (new)

**Why it exists:** URL parsing needs no page access at all, so it's kept separate — the
cheapest, most reliable, and easiest-to-test signal for "is this a LeetCode problem page".
**Contents:** `isLeetCodeProblemUrl(href)` (hostname check restricted to `leetcode.com` /
`*.leetcode.com` — deliberately not a loose substring check, to avoid a lookalike domain like
`notleetcode.com` or `leetcode.com.evil.example` passing) and `extractSlugFromUrl(href)`.
**Where used:** by `parser.ts` (slug) and `index.ts` (page-type guard before responding to a
message). Covered by `url.test.ts` (11 cases).

### `apps/extension/src/content/leetcode/selectors.ts` (new)

**Why it exists:** the single place LeetCode-specific CSS selectors and value whitelists live,
so a future markup change means editing this one file, not hunting through the codebase.
**Contents:** `TITLE_SELECTORS`, `DIFFICULTY_CONTAINER_SELECTORS`, `DESCRIPTION_SELECTORS`,
`CODE_EDITOR_LINE_CONTAINER_SELECTORS`, `LANGUAGE_CONTAINER_SELECTORS`,
`SUBMISSION_RESULT_CONTAINER_SELECTORS`, `DIFFICULTY_WHITELIST`, `KNOWN_LANGUAGES`, and a
re-export of `LEETCODE_SUBMISSION_STATUSES` from `packages/shared` as
`SUBMISSION_STATUS_WHITELIST`. **Where used:** exclusively by `extractor.ts` — nothing else
imports selector strings directly, which is what keeps DOM-selector knowledge from spreading
through the app. **What Phase 3+ will modify:** this is the expected point of change if/when
LeetCode's markup shifts, or when a content-script capture flow for other fields is added.

### `apps/extension/src/content/leetcode/extractor.ts` (new)

**Why it exists:** the actual DOM-reading logic, factored into small, individually-testable
functions that each take their search root as a parameter (not the global `document`) so they
can run against a synthetic jsdom document in tests. **Contents:** `queryFirstText`,
`getMetaContent`, `findExactTextMatch` (the shared whitelist-matching primitive underlying
`extractDifficulty`/`extractLanguage`/`extractSubmissionStatus`), `extractVisibleEditorCode`,
`extractRuntimeMemory`, `parseNumberedTitle`, `stripDocumentTitleSuffix`. **Where used:** by
`parser.ts` exclusively. Covered by `extractor.test.ts` (23 cases).

### `apps/extension/src/content/leetcode/parser.ts` (new)

**Why it exists:** the adapter's single public entry point —
`parseLeetCodeExtraction(doc, currentUrl)` — so nothing outside this folder needs to know how
extraction actually works internally. **Contents:** calls every extractor, assembles a typed
`LeetCodeExtraction`, and pushes a field name onto a `warnings` array for each `null` result.
**Where used:** by `index.ts` (the real content script) and directly by `parser.test.ts` (10
integration-style cases against full synthetic pages).

### `apps/extension/src/content/leetcode/types.ts` (new)

**Why it exists:** so every module under `content/leetcode/` imports its domain types from a
local module rather than reaching into `@codereviewai/shared` directly, keeping the folder
self-contained. **Contents:** a type-only re-export of the `LeetCode*` types from
`@codereviewai/shared`. **Where used:** `extractor.ts`, `parser.ts`.

### `apps/extension/src/content/leetcode/index.ts` (new)

**Why it exists:** the actual content script injected into the page (per `manifest.json`) —
the only file in the adapter that touches the real `document`/`window`/`chrome.*` globals.
**Contents:** a `chrome.runtime.onMessage` listener that ignores messages it doesn't recognize,
checks `isLeetCodeProblemUrl(window.location.href)`, and responds synchronously with either a
fresh `parseLeetCodeExtraction(document, window.location.href)` result or an error. Extraction
happens only on request — not automatically on page load — so the popup always sees the page's
current state, not a stale one-shot read from whenever the page first loaded. **Where used:**
bundled by `scripts/build.mjs` into `dist/content/leetcode.js`, loaded by Chrome per
`manifest.json`'s `content_scripts` entry.

### `apps/extension/src/lib/messaging.ts` (modified)

**Why it changed:** Phase 1 left this as a placeholder with one function. Phase 2 adds the real
message contract the popup and content script now use to talk to each other.
**Contents added:** `ExtractLeetCodeDataMessage`, `ExtensionMessage`,
`ExtractLeetCodeDataSuccess`, `ExtractLeetCodeDataFailure`, `ExtensionResponse`.
`getExtensionStatusMessage()` is kept (still used by the background worker's install log) with
updated, phase-neutral text. **Where used:** by `popup.ts` and `content/leetcode/index.ts`.

### `apps/extension/src/popup/popup.html`, `popup.ts`, `popup.css` (rewritten)

**Why they changed:** Phase 1's popup only displayed a static status string. Phase 2 needs a
real UI: six labeled fields (Problem, Difficulty, Language, Submission, Runtime, Memory), two
buttons (**Extract Problem**, **Analyze Solution**), and a collapsible debug `<pre>` block.
**What's implemented:** `popup.ts` queries the active tab, sends an
`EXTRACT_LEETCODE_DATA` message, and either renders the friendly fields (Extract Problem) or
renders the fields *and* dumps the full JSON into the debug block (Analyze Solution — the task
brief is explicit that this button must not call AI yet, only show extracted data for
debugging). Any field the extraction couldn't find renders as literally `"Unavailable"`, never
a blank or a guess. Errors (no active LeetCode tab, content script unreachable) surface as a
plain-language status message rather than a stack trace. **Where used:** loaded by Chrome as
the extension's popup per `manifest.json`'s `action.default_popup`.

### `apps/extension/manifest.json` (modified)

Added a `content_scripts` entry (`matches: ["https://leetcode.com/problems/*"]`, `js:
["content/leetcode.js"]`, `run_at: "document_idle"`); bumped `version` to `0.2.0`.
`permissions`/`host_permissions` remain `[]` — see §10.

### `apps/extension/scripts/build.mjs` (modified)

Added a third esbuild entry point, `'content/leetcode': .../src/content/leetcode/index.ts`,
alongside the existing `background` and `popup/popup` entries, so it bundles to
`dist/content/leetcode.js` (esbuild creates the nested output directory automatically for a
slash-containing entry key — no manual `mkdirSync` needed, unlike the static-asset copies).

### `apps/extension/package.json` (modified)

Added `@codereviewai/shared` as a runtime dependency (the content script imports
`LEETCODE_SUBMISSION_STATUSES` from it at runtime, not just types) and `jsdom` /
`@types/jsdom` as dev dependencies (used directly by the new test files — see §11). Bumped
`version` to `0.2.0`.

### `packages/shared/package.json` (modified)

Bumped `version` to `0.2.0` (new public export surface: the LeetCode types).

## 8. Important Selectors/Strategies

| Field | Strategy | Fallback chain |
| --- | --- | --- |
| Slug / problem-page detection | URL regex (`/problems/<slug>/...`) | None needed — URL is always available. |
| Title | Selector query (`[data-cy="question-title"]`, `a[href^="/problems/"]`) | `document.title` with `" - LeetCode"` suffix stripped. |
| Problem number | Regex on the resolved title (`^(\d+)\.\s*(.+)$`) | `null` if the title has no numeric prefix. |
| Difficulty | Exact-text whitelist scan (`Easy`/`Medium`/`Hard`), curated containers first | Whole-document leaf-element scan. |
| Description | Selector query (`[data-track-load="description_content"]`, etc.) | `<meta name="description">`. |
| Language | Exact-text whitelist scan against `KNOWN_LANGUAGES` | Whole-document leaf-element scan. |
| Submitted code | Join of `.view-line` elements inside `.monaco-editor .view-lines`, in DOM order | `null` if no editor lines exist. **Best-effort only** — see §14. |
| Submission status | Exact-text whitelist scan against `LEETCODE_SUBMISSION_STATUSES` | Whole-document leaf-element scan. |
| Runtime / memory | Regex (`\d+(\.\d+)?\s?ms` / `\d+(\.\d+)?\s?MB`) scoped to a matched result container | `null` for both — **no** whole-document fallback (regex substring matching is not safe enough against arbitrary page text). |

## 9. Data Flow

```
leetcode.com/problems/<slug>  (real page DOM)
        │  user clicks "Extract Problem" or "Analyze Solution" in the popup
        ▼
popup.ts: chrome.tabs.query({active, currentWindow}) → chrome.tabs.sendMessage(tabId, msg)
        │
        ▼
content/leetcode/index.ts (chrome.runtime.onMessage listener)
        │  isLeetCodeProblemUrl(window.location.href) guard
        ▼
parser.ts: parseLeetCodeExtraction(document, window.location.href)
        │  orchestrates url.ts + extractor.ts (selectors.ts + types.ts)
        ▼
LeetCodeExtraction  →  sendResponse(...)  →  popup.ts renders fields (+ raw JSON for Analyze)
```

Nothing in this flow leaves the browser — there is no `fetch`/`XMLHttpRequest` call anywhere in
the extraction path. Sending this data to the API is explicitly deferred to a later phase.

## 10. Security/Privacy Considerations

- **No new permissions.** `manifest.json`'s `permissions` and `host_permissions` are still
  `[]`. The content script gets page access purely through its `content_scripts.matches`
  entry, which Chrome honors for static injection without a duplicate `host_permissions`
  grant — this keeps the extension scoped to exactly `https://leetcode.com/problems/*`, not a
  broad `<all_urls>` grant.
- **Nothing is transmitted.** Extraction is entirely local: content script → popup, in memory,
  for the lifetime of the popup. No network call exists in this phase's extraction path.
- **No invented data.** Every extractor returns `null`, never a guess, when it can't find a
  value reliably — this matters for privacy/correctness once a later phase starts persisting
  or acting on this data: a `null` is an honest "unknown," not a fabricated value that could be
  mistaken for real.
- **Domain check is not a loose substring match.** `isLeetCodeProblemUrl` checks
  `hostname === 'leetcode.com' || hostname.endsWith('.leetcode.com')`, not
  `hostname.includes('leetcode.com')`, so a lookalike host (`leetcode.com.evil.example`) is
  correctly rejected rather than treated as LeetCode.
- **No secrets are involved in this phase** — extraction touches no credentials, so the
  broader "secrets stay server-side" principle from `docs/architecture.md` doesn't yet apply
  here, but remains the rule for the AI/GitHub phases that will eventually consume this data.

## 11. Testing

44 new tests across 3 files, all using `jsdom`'s `JSDOM` class directly to build synthetic
pages (not vitest's global `jsdom` environment — every extractor/parser function takes its
search root as an explicit parameter, so tests construct their own `Document` instances):

- **`url.test.ts`** (11 tests) — `isLeetCodeProblemUrl` for plain/sub-path/`www.`
  problem URLs, non-problem LeetCode pages, lookalike domains, and malformed URLs;
  `extractSlugFromUrl` for plain/sub-path/hyphenated slugs and invalid input.
- **`extractor.test.ts`** (23 tests) — `queryFirstText` (including an unsupported-selector
  case that must not throw), `getMetaContent`, `extractDifficulty` (including a
  non-exact-match prose case that must *not* false-positive), `extractLanguage`,
  `extractSubmissionStatus`, `extractVisibleEditorCode` (joins lines; returns `null` for an
  empty or absent editor), `extractRuntimeMemory` (including a case proving the whole-document
  fallback is intentionally absent), `parseNumberedTitle`, `stripDocumentTitleSuffix`.
- **`parser.test.ts`** (10 tests) — a full accepted-submission page extracting every field
  correctly; description falling back to a meta tag; title falling back to `document.title`
  without a numeric prefix; **a bare/empty page where every single field returns `null` and is
  listed in `warnings`, proving the "never invent data" requirement end to end**; a non-problem
  URL correctly reporting a `null` slug.

Browser-integration testing (loading the built extension into an actual Chrome instance
against the live leetcode.com site) was **not** performed — no browser automation was available
in this environment. This is called out explicitly in §14 rather than left implicit.

## 12. Exact Commands

```bash
npm install                                  # picks up jsdom/@types/jsdom, rebuilds shared
npm run typecheck                            # all 4 workspaces
npm run test                                 # all 4 workspaces (51 tests total)
npm run test -w @codereviewai/extension       # just the extension (44 tests)
npm run lint
npm run format
npm run build                                 # shared → api/web/extension
npm run build -w @codereviewai/extension       # just the extension → apps/extension/dist
```

## 13. Verification Steps

Performed against this repository as part of completing Phase 2:

1. `npm install` — succeeds, 0 vulnerabilities.
2. `npm run typecheck` — passes in all 4 workspaces.
3. `npm run test` — 51/51 tests pass (44 new extension tests + the 7 from Phase 1).
4. `npm run lint` — 0 errors, 0 warnings.
5. `npm run format:check` — all files match Prettier style.
6. `npm run build` — all 4 packages build; confirmed `apps/extension/dist` contains
   `background.js`, `content/leetcode.js`, and `popup/popup.js` + static assets, matching
   `manifest.json`'s references exactly; confirmed no `*.test.*` files leak into any `dist/`
   output.
7. Re-verified Phase 1 was not broken: `npm run start -w @codereviewai/api` (production build)
   started successfully and `GET /api/health` returned a valid response via `curl`.
8. Inspected the built `dist/content/leetcode.js` bundle directly to confirm it correctly
   pulled in `@codereviewai/shared`'s compiled output (the `LEETCODE_SUBMISSION_STATUSES`
   constant appears inlined near the top of the bundle).

**Not performed:** loading the unpacked extension into an actual Chrome window and testing
against a live `leetcode.com/problems/*` page — no browser automation tool was available in
this environment. See §14.

## 14. Known Limitations

- **Selectors are unverified against the live site.** Everything in `selectors.ts` is a
  reasoned, defensive guess at LeetCode's current markup, not something checked against the
  real leetcode.com DOM in this environment. The exact-text whitelist strategy (§4, §8) is
  designed specifically to reduce how much this matters, but it is not a substitute for
  actually loading the extension and testing it against a real problem page.
- **Submitted-code extraction is best-effort.** `.view-line` elements are Monaco's rendered
  output, not its underlying model — long files scrolled out of view may not have every line
  present in the DOM at extraction time (Monaco virtualizes rendering), and exact
  whitespace/indentation is not guaranteed to be preserved as literal characters. This was a
  deliberate trade-off: return a best-effort join with this caveat documented, rather than
  omit code extraction entirely, since the task brief asks for code "if accessible."
- **No browser-integration testing was performed** — see §11/§13. This is the single most
  important follow-up before relying on this extension against real submissions.
- **The extension still sends nothing to the API.** Extraction and display only.
- Everything listed as out of scope in the phase objective (AI, GitHub, auth, database,
  dashboard) remains unimplemented, as required.

## 15. LeetCode Compatibility Risks

| Risk | Likelihood | Mitigation already in place |
| --- | --- | --- |
| LeetCode renames/removes a CSS class the curated selectors target | High over time — LeetCode's classes are largely auto-generated/utility CSS | Exact-text whitelist matching (difficulty, language, status) doesn't depend on the selector matching at all in the worst case; only title/description/code lose their primary path. |
| LeetCode restructures the editor (e.g. moves off Monaco) | Low short-term, but would break code extraction entirely | `extractVisibleEditorCode` is isolated to one function; a future swap only requires rewriting that one function and its selector. |
| LeetCode changes the `/problems/<slug>/` URL pattern | Low — this URL shape has been stable for years | Isolated to `url.ts`; the rest of the adapter takes the resolved slug/URL as input, not the raw URL. |
| LeetCode changes how difficulty/language/status text is rendered (e.g. adds icons instead of text, or translates it) | Medium | Would break the whitelist match for that locale; the field would correctly report `null`/"Unavailable" rather than showing wrong data — a safe failure mode, not a silent wrong answer. |
| A/B tests or logged-out vs. logged-in DOM differences | Medium | Not specifically handled — this is a real residual risk noted here for future investigation, since it wasn't possible to test different account states without browser access. |

The overarching mitigation strategy is architectural, not selector-specific: every extractor
degrades to `null` instead of throwing or guessing, `selectors.ts` isolates every guess in one
file, and the exact-text whitelist strategy is deliberately *not* selector-dependent for three
of the eight fields — so a selector-only breakage narrows what's lost rather than breaking
extraction wholesale.

## 16. What Phase 3 Will Implement

Per the roadmap in the README, Phase 3 will build API endpoints to receive and store captured
submissions — the extension will start sending the `LeetCodeExtraction` payload built in this
phase to `apps/api` (likely a `POST /api/submissions`-style endpoint), and `apps/api` will gain
its first real persistence-adjacent logic (though full database persistence is Phase 4). This
phase's `LeetCodeExtraction` shared type is the contract that endpoint will accept.
