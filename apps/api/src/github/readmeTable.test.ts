import { describe, expect, it } from 'vitest';
import {
  mergeProblemsTableIntoReadme,
  renderProblemsTable,
  TABLE_END_MARKER,
  TABLE_START_MARKER,
  type ProblemIndexEntry,
} from './readmeTable.js';

function entry(overrides: Partial<ProblemIndexEntry> = {}): ProblemIndexEntry {
  return {
    number: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    pattern: 'Hash Map',
    complexity: 'O(n)',
    status: 'Accepted',
    path: 'problems/001-two-sum/README.md',
    ...overrides,
  };
}

describe('renderProblemsTable', () => {
  it('renders a placeholder when there are no entries', () => {
    expect(renderProblemsTable([])).toBe('_No problems published yet._');
  });

  it('renders a header row and one row per entry', () => {
    const result = renderProblemsTable([entry()]);
    expect(result).toContain('| # | Problem | Difficulty | Pattern | Complexity | Status |');
    expect(result).toContain('[Two Sum](problems/001-two-sum/README.md)');
    expect(result).toContain('Easy');
    expect(result).toContain('Hash Map');
    expect(result).toContain('O(n)');
    expect(result).toContain('Accepted');
  });

  it('sorts entries by problem number', () => {
    const result = renderProblemsTable([
      entry({ number: 15, slug: 'p15', title: 'P15', path: 'problems/015-p15/README.md' }),
      entry({ number: 3, slug: 'p3', title: 'P3', path: 'problems/003-p3/README.md' }),
    ]);
    const p3Index = result.indexOf('P3');
    const p15Index = result.indexOf('P15');
    expect(p3Index).toBeLessThan(p15Index);
  });

  it('places entries with an unknown number last', () => {
    const result = renderProblemsTable([
      entry({
        number: null,
        slug: 'unknown',
        title: 'Unknown',
        path: 'problems/unknown/README.md',
      }),
      entry({ number: 1, slug: 'first', title: 'First', path: 'problems/001-first/README.md' }),
    ]);
    const firstIndex = result.indexOf('First');
    const unknownIndex = result.indexOf('Unknown');
    expect(firstIndex).toBeLessThan(unknownIndex);
  });

  it('falls back to "Unknown" for null difficulty/status and empty pattern/complexity', () => {
    const result = renderProblemsTable([
      entry({ difficulty: null, status: null, pattern: '', complexity: '' }),
    ]);
    expect(result).toMatch(/\| Unknown \| Unknown \| Unknown \|/);
  });

  it('escapes a pipe character in a title so it cannot break the table', () => {
    const result = renderProblemsTable([entry({ title: 'A | B Problem' })]);
    expect(result).toContain('A \\| B Problem');
  });
});

describe('mergeProblemsTableIntoReadme', () => {
  it('scaffolds a default README when none exists yet', () => {
    const result = mergeProblemsTableIntoReadme(null, [entry()]);
    expect(result).toContain('# LeetCode AI Journal');
    expect(result).toContain(TABLE_START_MARKER);
    expect(result).toContain(TABLE_END_MARKER);
    expect(result).toContain('Two Sum');
  });

  it('appends the marked block after existing content when no markers are present yet', () => {
    const existing = '# My Journal\n\nSome hand-written intro text.\n';
    const result = mergeProblemsTableIntoReadme(existing, [entry()]);
    expect(result).toContain('Some hand-written intro text.');
    expect(result).toContain(TABLE_START_MARKER);
    expect(result.indexOf('Some hand-written intro text.')).toBeLessThan(
      result.indexOf(TABLE_START_MARKER),
    );
  });

  it('replaces only the content between existing markers, preserving everything else', () => {
    const existing = [
      '# My Journal',
      '',
      'Hand-written intro — never touch this.',
      '',
      TABLE_START_MARKER,
      '',
      'stale old table content',
      '',
      TABLE_END_MARKER,
      '',
      'Hand-written outro — never touch this either.',
    ].join('\n');

    const result = mergeProblemsTableIntoReadme(existing, [entry()]);

    expect(result).toContain('Hand-written intro — never touch this.');
    expect(result).toContain('Hand-written outro — never touch this either.');
    expect(result).not.toContain('stale old table content');
    expect(result).toContain('Two Sum');
  });

  it('updates the table in place across two successive merges without duplicating markers', () => {
    const first = mergeProblemsTableIntoReadme(null, [entry()]);
    const second = mergeProblemsTableIntoReadme(first, [
      entry(),
      entry({
        number: 2,
        slug: 'add-two-numbers',
        title: 'Add Two Numbers',
        path: 'problems/002-add-two-numbers/README.md',
      }),
    ]);

    expect(second.split(TABLE_START_MARKER).length - 1).toBe(1);
    expect(second.split(TABLE_END_MARKER).length - 1).toBe(1);
    expect(second).toContain('Two Sum');
    expect(second).toContain('Add Two Numbers');
  });
});
