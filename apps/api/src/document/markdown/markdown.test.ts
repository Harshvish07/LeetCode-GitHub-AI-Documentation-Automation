import { describe, expect, it } from 'vitest';
import {
  blockquote,
  bulletList,
  codeBlock,
  escapeMarkdown,
  heading,
  table,
  tableCell,
} from './markdown.js';

describe('heading', () => {
  it('renders each level with the right number of #s', () => {
    expect(heading(1, 'Title')).toBe('# Title');
    expect(heading(2, 'Section')).toBe('## Section');
    expect(heading(6, 'Deep')).toBe('###### Deep');
  });
});

describe('bulletList', () => {
  it('renders one "- " line per item', () => {
    expect(bulletList(['a', 'b'])).toBe('- a\n- b');
  });

  it('renders a fallback line when the list is empty', () => {
    expect(bulletList([])).toBe('- (none)');
  });

  it('accepts a custom empty-list message', () => {
    expect(bulletList([], 'Nothing to report.')).toBe('- Nothing to report.');
  });
});

describe('blockquote', () => {
  it('prefixes every line with "> "', () => {
    expect(blockquote('line one\nline two')).toBe('> line one\n> line two');
  });

  it('renders a bare ">" for blank lines instead of a trailing space', () => {
    expect(blockquote('a\n\nb')).toBe('> a\n>\n> b');
  });
});

describe('codeBlock', () => {
  it('fences plain code with a 3-backtick fence', () => {
    expect(codeBlock('const x = 1;', 'javascript')).toBe('```javascript\nconst x = 1;\n```');
  });

  it('preserves the code exactly — no escaping, no modification', () => {
    const code = 'let s = "*_[weird]_* chars & <tags>";';
    const result = codeBlock(code);
    expect(result).toContain(code);
  });

  it('widens the fence when the code itself contains a run of 3 backticks', () => {
    const code = 'const template = `a`;\n```\nnested fence look-alike\n```';
    const result = codeBlock(code);
    const lines = result.split('\n');
    expect(lines[0]).toBe('````');
    expect(lines[lines.length - 1]).toBe('````');
    // the code's own ``` lines must survive untouched in the middle
    expect(result).toContain('```\nnested fence look-alike\n```');
  });

  it('widens the fence further for a longer backtick run inside the code', () => {
    const code = 'text with ````` five backticks';
    const result = codeBlock(code);
    const fenceLine = result.split('\n')[0]!;
    expect(fenceLine.length).toBeGreaterThanOrEqual(6);
  });

  it('uses at least a 3-backtick fence even for code with no backticks at all', () => {
    const result = codeBlock('no backticks here');
    expect(result.startsWith('```\n')).toBe(true);
  });
});

describe('escapeMarkdown', () => {
  it('escapes backslashes, backticks, asterisks, underscores, and brackets', () => {
    expect(escapeMarkdown('a\\b`c*d_e[f]g')).toBe('a\\\\b\\`c\\*d\\_e\\[f\\]g');
  });

  it('escapes angle brackets', () => {
    expect(escapeMarkdown('a <script> tag')).toBe('a \\<script\\> tag');
  });

  it('neutralizes a leading heading marker', () => {
    expect(escapeMarkdown('# not a heading')).toBe('\\# not a heading');
    expect(escapeMarkdown('###### also not a heading')).toBe('\\###### also not a heading');
  });

  it('does not treat a bare "#" mid-word as a heading marker', () => {
    expect(escapeMarkdown('C# is a language')).toBe('C# is a language');
  });

  it('neutralizes a leading bullet/blockquote/ordered-list marker', () => {
    expect(escapeMarkdown('- not a bullet')).toBe('\\- not a bullet');
    expect(escapeMarkdown('> not a quote')).toBe('\\> not a quote');
    expect(escapeMarkdown('1. not a list item')).toBe('\\1. not a list item');
    expect(escapeMarkdown('1) also not a list item')).toBe('\\1) also not a list item');
  });

  it('neutralizes a thematic-break-shaped line via asterisk/underscore escaping', () => {
    expect(escapeMarkdown('***')).toBe('\\*\\*\\*');
    expect(escapeMarkdown('___')).toBe('\\_\\_\\_');
  });

  it('neutralizes a setext-heading-shaped "===" underline', () => {
    expect(escapeMarkdown('Title\n===')).toBe('Title\n\\===');
  });

  it('preserves leading indentation when neutralizing a marker', () => {
    expect(escapeMarkdown('  - indented bullet')).toBe('  \\- indented bullet');
  });

  it('leaves ordinary punctuation (periods, hyphens mid-word, parens) untouched', () => {
    const text = 'e.g., O(n) time — a well-known result.';
    expect(escapeMarkdown(text)).toBe(text);
  });

  it('handles multi-line text, escaping each line independently', () => {
    const input = '# line one\nnormal line\n- line three';
    expect(escapeMarkdown(input)).toBe('\\# line one\nnormal line\n\\- line three');
  });

  it('cannot be used to break out of a fenced code block (a run of backticks becomes individually-escaped)', () => {
    const result = escapeMarkdown('```\nfake fence\n```');
    expect(result).not.toContain('```');
    expect(result).toContain('\\`\\`\\`');
  });
});

describe('tableCell', () => {
  it('escapes a pipe character so it cannot break out of the table column', () => {
    expect(tableCell('a | b')).toBe('a \\| b');
  });

  it('collapses newlines to spaces', () => {
    expect(tableCell('line one\nline two')).toBe('line one line two');
  });

  it('also applies ordinary inline escaping', () => {
    expect(tableCell('*bold*')).toBe('\\*bold\\*');
  });
});

describe('table', () => {
  it('renders a header row, separator row, and body rows', () => {
    const result = table(
      ['A', 'B'],
      [
        ['1', '2'],
        ['3', '4'],
      ],
    );
    expect(result).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |');
  });

  it('renders a header-only table when there are no rows', () => {
    const result = table(['A', 'B'], []);
    expect(result).toBe('| A | B |\n| --- | --- |');
  });
});
