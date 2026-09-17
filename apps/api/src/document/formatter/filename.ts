/**
 * Generates a safe, filesystem-friendly filename for a generated document —
 * `NNN-slug.md`, e.g. `001-two-sum.md`, or just `slug.md` when the problem
 * number isn't known. Phase 3's schema already guarantees a stored
 * submission's `problem.slug` is lowercase letters/digits/hyphens only, but
 * this function re-sanitizes defensively rather than trusting that — it's
 * meant to be safe standalone, including against a slug/title containing
 * path-traversal-shaped input (`../`, `/`, `\`), which the sanitizer
 * collapses into ordinary hyphens like any other non-alphanumeric run.
 */

export interface FilenameInput {
  slug: string | null;
  number: number | null;
  /** Used as a fallback source when `slug` is null (defensive only — Phase 3 requires a non-null slug for every stored submission). */
  title?: string | null;
}

const FALLBACK_SLUG = 'untitled-problem';

export function generateDocumentFilename(input: FilenameInput): string {
  const base = input.slug ?? input.title ?? FALLBACK_SLUG;
  const safeSlug = sanitizeSlug(base);
  const prefix = input.number !== null ? `${String(input.number).padStart(3, '0')}-` : '';
  return `${prefix}${safeSlug}.md`;
}

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.length > 0 ? cleaned : FALLBACK_SLUG;
}
