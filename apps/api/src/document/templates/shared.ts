import { escapeMarkdown } from '../markdown/markdown.js';

/** Renders a nullable field as its escaped value, or a fallback label — never invents a value for a field the extractor couldn't find. */
export function fieldOr(value: string | null, fallback: string): string {
  return value === null ? fallback : escapeMarkdown(value);
}
