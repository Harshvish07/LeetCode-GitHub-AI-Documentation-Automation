import { describe, expect, it } from 'vitest';
import { generateDocumentFilename } from './filename.js';

describe('generateDocumentFilename', () => {
  it('produces "NNN-slug.md" with a 3-digit zero-padded number', () => {
    expect(generateDocumentFilename({ slug: 'two-sum', number: 1 })).toBe('001-two-sum.md');
  });

  it('does not truncate a problem number wider than 3 digits', () => {
    expect(generateDocumentFilename({ slug: 'some-problem', number: 2547 })).toBe(
      '2547-some-problem.md',
    );
  });

  it('omits the numeric prefix entirely when number is null', () => {
    expect(generateDocumentFilename({ slug: 'two-sum', number: null })).toBe('two-sum.md');
  });

  it('passes an already-clean slug through unchanged', () => {
    expect(generateDocumentFilename({ slug: 'longest-common-subsequence', number: 1143 })).toBe(
      '1143-longest-common-subsequence.md',
    );
  });

  it('lowercases and hyphenates a messy slug', () => {
    expect(generateDocumentFilename({ slug: 'Two Sum!!', number: 1 })).toBe('001-two-sum.md');
  });

  it('collapses path-traversal-shaped input into ordinary hyphens', () => {
    const filename = generateDocumentFilename({ slug: '../../etc/passwd', number: null });
    expect(filename).not.toContain('..');
    expect(filename).not.toContain('/');
    expect(filename).toBe('etc-passwd.md');
  });

  it('collapses backslashes the same way', () => {
    const filename = generateDocumentFilename({ slug: '..\\windows\\system32', number: null });
    expect(filename).not.toContain('\\');
    expect(filename).not.toContain('..');
  });

  it('falls back to the title when slug is null', () => {
    expect(
      generateDocumentFilename({ slug: null, number: 42, title: 'Reverse a Linked List!' }),
    ).toBe('042-reverse-a-linked-list.md');
  });

  it('falls back to a generic name when both slug and title are null', () => {
    expect(generateDocumentFilename({ slug: null, number: null, title: null })).toBe(
      'untitled-problem.md',
    );
  });

  it('falls back to a generic name when the slug sanitizes to nothing at all', () => {
    expect(generateDocumentFilename({ slug: '!!!???', number: null })).toBe('untitled-problem.md');
  });
});
