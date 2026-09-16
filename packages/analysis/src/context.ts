/**
 * Every analyzer in this package receives the same pre-processed view of the
 * submitted code, built once here, instead of each one re-splitting/
 * re-lowercasing the source independently.
 */
export interface CodeContext {
  code: string;
  lines: string[];
  /** Lowercased code, for case-insensitive keyword matching. */
  normalized: string;
  language: string | null;
}

export function buildCodeContext(code: string, language: string | null): CodeContext {
  return {
    code,
    lines: code.split(/\r\n|\r|\n/),
    normalized: code.toLowerCase(),
    language,
  };
}
