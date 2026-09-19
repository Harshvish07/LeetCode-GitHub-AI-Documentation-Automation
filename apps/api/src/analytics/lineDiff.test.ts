import { describe, expect, it } from 'vitest';
import { diffLines } from './lineDiff.js';

describe('diffLines', () => {
  it('reports identical code as identical', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual({ added: 0, removed: 0, identical: true });
  });

  it('ignores indentation, blank lines, and CRLF', () => {
    expect(diffLines('a\n  b\n\n', 'a\r\nb').identical).toBe(true);
  });

  it('counts added and removed lines', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc\nd')).toEqual({ added: 2, removed: 1, identical: false });
  });

  it('handles empty inputs', () => {
    expect(diffLines('', 'a\nb')).toEqual({ added: 2, removed: 0, identical: false });
    expect(diffLines('', '').identical).toBe(true);
  });

  it('falls back to a line-frequency comparison for very large inputs', () => {
    const big = Array.from({ length: 1600 }, (_, i) => `line ${i}`).join('\n');
    expect(diffLines(big, `${big}\nextra`)).toEqual({ added: 1, removed: 0, identical: false });
  });
});
