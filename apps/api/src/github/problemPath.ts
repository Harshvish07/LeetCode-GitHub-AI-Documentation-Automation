import { generateDocumentFilename } from '../document/formatter/filename.js';

/**
 * Builds the path a problem's document lives at inside the target
 * repository — `problems/NNN-slug/README.md`, per the task's required
 * repository layout. Deliberately reuses `document/formatter/filename.ts`'s
 * `generateDocumentFilename()` rather than re-implementing slug
 * sanitization: Phase 6's docs predicted exactly this reuse ("neither has
 * any knowledge of *where* the document ends up"), so the numbering/
 * sanitization/path-traversal-safety logic only ever needs to be correct
 * (and tested) in one place.
 */
export function buildProblemRepoPath(input: {
  slug: string | null;
  number: number | null;
  title?: string | null;
}): string {
  const filename = generateDocumentFilename(input);
  const folder = filename.replace(/\.md$/, '');
  return `problems/${folder}/README.md`;
}

export const PROBLEMS_INDEX_PATH = 'problems/index.json';
export const ROOT_README_PATH = 'README.md';
