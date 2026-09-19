# Document Generation

This document explains the Markdown learning-document generator added in Phase 6: what a
generated document contains, how it's built, its filename strategy, and how it protects against
malformed Markdown from arbitrary (AI-generated or extracted) text. For the endpoint's
request/response shape, see
[docs/api.md](api.md#post-apisubmissionsiddocument). For the full phase record (every file, why
it exists, exact test coverage), see [docs/phases/phase-06.md](phases/phase-06.md).

## Document schema

Every generated document has exactly these sections, in this order:

1. `# LeetCode Problem: <title>`
2. `## Problem Information` — number, title, difficulty, URL, language, status, runtime, memory
3. `## Problem Understanding` — the AI's `problemSummary`, plus the raw extracted description for reference
4. `## My Solution` — the exact submitted code, labeled **YOUR SOLUTION**
5. `## My Approach` — the AI's `userApproach`
6. `## DSA Pattern Used` — AI-identified patterns, static-analysis-detected patterns, and an explicit agreement/disagreement note
7. `## Why My Solution Works` — the AI's `whyItWorks`
8. `## Complexity Analysis` — a headline verdict, LeetCode's own reported runtime/memory, the static estimate, the AI assessment, and an agreement note
9. `## What I Did Well` — the AI's `strengths`
10. `## What Can Be Improved` — the AI's `improvements`, plus `correctnessConcerns` if any
11. `## Is My Solution Optimal?` — Yes/No plus reasoning
12. `## Better Approach` — either an explicit "no better approach exists" statement, or a **RECOMMENDED SOLUTION** with description, pseudocode, working code, complexity, and why it's better
13. `## Alternative Approaches`
14. `## Edge Cases` — AI-identified, plus static-analysis edge-case observations if any
15. `## Interview Explanation` — a templated, concise summary (approach + why it works + complexity)
16. `## Key Learning` — the AI's `learningPoints`
17. `## Related Problems / Patterns` — the AI's `relatedPatterns`
18. `## Personal Review` — a templated closing summary (optimality verdict, top takeaway, both confidence levels, and a disagreement note if applicable)
19. A footer with the generation timestamp and submission id

**Optional sections (Phase 9).** Between Personal Review and the footer, the document may also contain
`## Submission History` (a table of every attempt up to and including this one), `## How My Solution
Improved` (the attempt-to-attempt story), and `## Recurring Mistakes` (weaknesses the stored history
supports). They appear only when `generateDocument()` is given `history` (two or more attempts)
or `recurringMistakes` (at least one) — which the document and publish endpoints do only with a
database configured, best-effort. Without them the document is exactly the 19 parts above. Every
value comes from stored data and is escaped like all other dynamic text; the user's code is untouched.
See [docs/improvement-engine.md](improvement-engine.md#document-sections).

This maps directly onto the task's required structure. Two sections — **Interview Explanation**
and **Personal Review** — are *not* new AI-generated fields; they're composed from fields the AI
review (Phase 5) already produces (`userApproach`, `whyItWorks`, `complexity`, `optimality`,
`learningPoints`, `confidence`). Templating them keeps the AI schema/prompt focused on the 16
required review questions instead of growing a new field for every way this document's layout
might want to re-present the same information.

## Where the data comes from

Nothing in this phase adds new inputs. Every field comes from a `CombinedSolutionReview`
(Phase 5's `deterministic` + `ai` + `agreement`, rebuilt fresh via `buildCombinedReview()` —
see below) plus the stored submission's own `problem`/`submission` data (needed for the
"Problem Information" and "My Solution" sections, since `CombinedSolutionReview` itself doesn't
carry them).

`services/combined-review.service.ts`'s `buildCombinedReview()` — extracted in this phase from
what was previously inlined in `reviews.controller.ts` — is now shared by both
`POST /api/submissions/:id/review` and `POST /api/submissions/:id/document`, so a generated
document is always built from a **freshly computed** review, exactly like the review endpoint,
never a stale or cached one. This also means generating a document costs exactly what
generating a review costs: one AI provider call, at full cost — see
[docs/ai-analysis.md#cost-considerations](ai-analysis.md#cost-considerations).

## Two extensions to the AI schema

Phase 6 required two pieces of data the Phase 5 AI schema didn't yet produce, so
`ai/schemas/solutionReview.schema.ts`'s `betterApproach` object gained two new **required**
fields (only required when `betterApproach` itself is non-null):

- `pseudocode` (string) — a short, language-agnostic step-by-step outline
- `code` (string) — a working implementation, ideally in the submission's own language

`ai/prompts/reviewPrompt.ts`'s system prompt was updated to ask for both. This is the one place
Phase 6 reached back into Phase 5's AI contract — everything else in this phase is purely a new
consumer of data that already existed. No other Phase 5 field, prompt behavior, or test changed.

## Template architecture

```
apps/api/src/document/
├── markdown/
│   ├── markdown.ts        Low-level primitives: heading(), bulletList(), blockquote(),
│   │                       codeBlock(), escapeMarkdown() — the only place that knows
│   │                       Markdown syntax
│   └── languageTag.ts      Maps LeetCode's language whitelist to fence-language identifiers
├── templates/
│   ├── shared.ts            fieldOr() — render a nullable field or a fallback label
│   ├── problemSection.ts     Problem Information + Problem Understanding
│   ├── solutionSection.ts    My Solution + My Approach + DSA Pattern Used + Why It Works
│   ├── complexitySection.ts  Complexity Analysis
│   ├── reviewSection.ts      Strengths + Improvements + Optimal? + Better Approach + Alternatives
│   └── learningSection.ts    Edge Cases + Interview Explanation + Key Learning + Related + Personal Review
├── formatter/
│   └── filename.ts          generateDocumentFilename() — safe filename generation
├── types.ts                  DocumentGenerationInput, GeneratedDocument
└── document-generator.ts     generateDocument() — the only exported entry point
```

Every template function is built exclusively from `markdown/markdown.ts`'s primitives — no
template ever writes a raw `#`, backtick fence, or `- ` bullet marker itself. This means fence
width, escaping, and list formatting only ever need fixing in one file.
`controllers/documents.controller.ts` calls `generateDocument()` and nothing else — the task's
"do not generate Markdown inside controllers" requirement, enforced by the controller simply
having no Markdown-building code available to it at all.

## Filename strategy

`formatter/filename.ts`'s `generateDocumentFilename()` produces the flat, single-file format:

```
001-two-sum.md
```

`NNN-` is the problem number, zero-padded to at least 3 digits (a number ≥ 1000 is not
truncated — `String(number).padStart(3, '0')`), omitted entirely when the number is unknown
(`two-sum.md`). The slug is lowercased, and any run of non-alphanumeric characters (spaces,
punctuation, `/`, `\`, `..`) is collapsed to a single hyphen and trimmed from the ends — so a
path-traversal-shaped slug like `../../etc/passwd` sanitizes to `etc-passwd.md`, never anything
that could escape an intended output directory. Falls back to the title (sanitized the same way)
when the slug is null, and to `untitled-problem.md` when both are null or sanitize to nothing.

This function re-sanitizes even though Phase 3's schema already guarantees a stored
submission's `problem.slug` is clean (`^[a-z0-9-]+$`) — it's meant to be safe standalone, not
dependent on every future caller having already validated its input.

**Why the flat-file format over `001-two-sum/README.md`:** simpler, and this phase doesn't write
anything to disk at all (see [Limitations](#limitations)) — the response is `{ filename,
content }` for the caller to do with as it likes. A future phase (GitHub publishing) can decide
the actual repository layout without this module needing to change.

## Escaping

`markdown/markdown.ts`'s `escapeMarkdown()` is applied to every piece of dynamic text embedded
as document prose — problem titles/descriptions, and every AI-generated string (`userApproach`,
`whyItWorks`, `strengths`, etc.). It never touches actual source code — see
[Exact-code preservation](#exact-code-preservation) below.

It does two things:

1. **Escapes inline-significant characters** — backslash, backtick, asterisk, underscore, `[`,
   `]`, `<`, `>` — so stray Markdown syntax in AI prose or an extracted problem description
   can't create an unintended inline-code span, emphasis, link bracket, or raw HTML tag.
2. **Neutralizes leading block-structure markers**, line by line — a line starting with `#`
   (1-6 of them), `-`, `+`, `>`, or an ordered-list marker (`1.`/`1)`) gets a backslash inserted
   before that marker, so it can't hijack the document into an unintended heading, list, or
   blockquote. A line consisting only of `=` characters (a setext-heading underline) is handled
   the same way.

This targets **GitHub-Flavored Markdown** rendering specifically (the project's documents are
ultimately headed for a GitHub repository — see the Phase 7 note in
[phase-06.md](phases/phase-06.md#what-phase-7-will-implement)), not the strictest possible
reading of the CommonMark spec. GitHub's own Markdown guide documents `\#`, `\-`, etc. as valid
escapes recognized before block structure is applied; some other renderers formally parse block
structure first and would not honor a leading backslash the same way. This is a known,
deliberate scope boundary — see [Limitations](#limitations).

**Trade-off worth knowing:** because every backtick in prose is escaped, an AI response that
intentionally used backticks for inline code (`` `nums` ``) renders as plain, unstyled
characters instead of monospaced inline code — safety against fence break-out and injected
structure was chosen over preserving that one piece of intentional formatting.

## Exact-code preservation

The task's strongest requirement — "do not modify the user's code" — is enforced structurally,
not by convention: `document-generator.ts` passes `submission.code` straight into
`markdown/markdown.ts`'s `codeBlock()` with **no call to `escapeMarkdown()` anywhere on that
path**. `codeBlock()` never alters its input string in any way; its only job is choosing a fence
long enough that the code's own content can't prematurely close it — it scans the code for the
longest run of consecutive backticks already present and uses a fence one backtick longer
(minimum 3), so code that itself contains a ` ``` ` block (e.g. a solution that builds a
Markdown string) round-trips byte-for-byte. `document-generator.test.ts` asserts this directly
(`content).toContain(code)`) for code containing quotes, backslashes, and embedded triple-backtick
sequences.

The "My Solution" section is explicitly labeled **YOUR SOLUTION**, and the "Better Approach"
section's code (when present) is explicitly labeled **RECOMMENDED SOLUTION** — the task's
requirement that the two never be confused or one silently replace the other. The submitted
code is never overwritten, summarized, or omitted in favor of the recommended one; both are
always shown, in that order, clearly labeled.

## Deterministic vs AI content, carried forward from Phase 5

The "DSA Pattern Used", "Complexity Analysis", and "Edge Cases" sections all deliberately show
**both** the static-analysis view and the AI view side by side, with an explicit agreement or
disagreement note (reusing Phase 5's `agreement.ts`/`ReviewAgreement`) rather than merging them
into one answer — the same "never hide the disagreement" principle from Phase 5, carried into
the document itself rather than left behind in the JSON response.

## Example document

Generated live via `POST /api/submissions/:id/document` against the real Gemini provider (see
[docs/phases/phase-06.md](phases/phase-06.md#example-generated-document) for the full document
and the exact submission that produced it). Excerpt:

```markdown
# LeetCode Problem: Two Sum

## Problem Information
- **Problem Number:** 1
- **Title:** Two Sum
...

## My Solution

**YOUR SOLUTION** (submitted code — shown exactly as submitted, unmodified):

\`\`\`javascript
var twoSum = function(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
};
\`\`\`

## DSA Pattern Used

**AI-identified patterns:**
- Brute Force
- Nested Loops

**Static-analysis-detected patterns:**
- None detected.

⚠️ Only the AI identified: Brute Force, Nested Loops.
```

This is a real example of the disagreement surfacing correctly: the deterministic engine (which
only recognizes 19 specific named patterns — see
[docs/phases/phase-04.md](phases/phase-04.md)) didn't tag "Brute Force" for this code, while the
AI did — the document shows exactly that, rather than picking one and hiding the other.

## Limitations

- **Nothing is written to disk, and nothing is published anywhere.** `POST
  /api/submissions/:id/document` returns `{ filename, content }` in the HTTP response only.
  Saving it locally or committing it to a GitHub repository is explicitly out of scope for this
  phase — see [What Phase 7 Will Implement](phases/phase-06.md#what-phase-7-will-implement).
- **No document persistence.** Like the review endpoint, calling this endpoint twice for the
  same submission regenerates the document from scratch (a fresh AI call each time) — there is
  no caching or storage of a previously generated document.
- **Escaping targets GitHub-Flavored Markdown, not strict CommonMark.** See
  [Escaping](#escaping) above — a renderer that applies block-structure parsing strictly before
  honoring backslash escapes could, in principle, still misrender a line-leading marker inside
  AI-sourced prose. This has not been observed against GitHub's own renderer.
- **Backtick-based inline code intentionally used by the AI is not preserved as styled inline
  code** — see the escaping trade-off noted above.
- **"Is My Solution Optimal?" only ever answers Yes or No.** The task's document structure
  mentions a "Depends" outcome, but `SolutionReview.optimality.isOptimal` (Phase 5's schema) is
  a plain boolean; a genuinely ambiguous case would need to be expressed through the
  free-text `reasoning` field, not a third enum value. Changing this would mean widening Phase
  5's schema again, which this phase didn't judge necessary for now.
- **No execution-based verification, still.** Everything in this document — including the
  "Better Approach" code — is unverified by actually running it, for the same reasons documented
  in [docs/ai-analysis.md#limitations](ai-analysis.md#limitations).
