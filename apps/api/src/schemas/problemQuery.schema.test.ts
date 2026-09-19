import { describe, expect, it } from 'vitest';
import { parseProblemQuery } from './problemQuery.schema.js';

describe('parseProblemQuery', () => {
  it('accepts an empty query', () => {
    expect(parseProblemQuery({})).toEqual({ success: true, query: {} });
  });

  it('accepts every supported parameter', () => {
    const result = parseProblemQuery({
      search: ' two ',
      difficulty: 'Medium',
      pattern: 'Hash Map',
      status: 'Accepted',
      language: 'Python',
      sortBy: 'quality',
      sortOrder: 'desc',
    });
    expect(result).toEqual({
      success: true,
      query: {
        search: 'two',
        difficulty: 'Medium',
        pattern: 'Hash Map',
        status: 'Accepted',
        language: 'Python',
        sortBy: 'quality',
        sortOrder: 'desc',
      },
    });
  });

  it('treats empty and whitespace-only values as absent (what a form sends for "no filter")', () => {
    expect(parseProblemQuery({ difficulty: '', search: '   ', pattern: '' })).toEqual({
      success: true,
      query: {},
    });
  });

  it('uses the first value when a parameter is repeated', () => {
    const result = parseProblemQuery({ difficulty: ['Hard', 'Easy'] });
    expect(result).toEqual({ success: true, query: { difficulty: 'Hard' } });
  });

  it.each([
    [{ difficulty: 'Impossible' }, 'difficulty'],
    [{ pattern: 'Brute Force' }, 'pattern'],
    [{ sortBy: 'colour' }, 'sortBy'],
    [{ sortOrder: 'sideways' }, 'sortOrder'],
    [{ search: 'x'.repeat(201) }, 'search'],
  ])('rejects an invalid value (%j)', (raw, path) => {
    const result = parseProblemQuery(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.path).toBe(path);
  });
});
