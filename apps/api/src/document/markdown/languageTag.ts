import type { LeetCodeLanguage } from '@codereviewai/shared';

/** Maps LeetCode's language whitelist to the fence-language identifiers GitHub's Markdown renderer recognizes for syntax highlighting. Falls back to no tag (plain fence) for anything unmapped, rather than guessing. */
const LANGUAGE_FENCE_TAGS: Partial<Record<LeetCodeLanguage, string>> = {
  'C++': 'cpp',
  Java: 'java',
  Python: 'python',
  Python3: 'python',
  C: 'c',
  'C#': 'csharp',
  JavaScript: 'javascript',
  TypeScript: 'typescript',
  PHP: 'php',
  Swift: 'swift',
  Kotlin: 'kotlin',
  Dart: 'dart',
  Go: 'go',
  Ruby: 'ruby',
  Scala: 'scala',
  Rust: 'rust',
  Racket: 'racket',
  Erlang: 'erlang',
  Elixir: 'elixir',
  MySQL: 'sql',
  'MS SQL Server': 'sql',
  Oracle: 'sql',
  'PL/SQL': 'sql',
  Bash: 'bash',
};

export function fenceLanguageTag(language: LeetCodeLanguage | null): string {
  if (language === null) return '';
  return LANGUAGE_FENCE_TAGS[language] ?? '';
}
