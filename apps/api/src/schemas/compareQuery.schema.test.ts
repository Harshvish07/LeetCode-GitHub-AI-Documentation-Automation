import { describe, expect, it } from 'vitest';
import { parseCompareQuery } from './compareQuery.schema.js';

describe('parseCompareQuery', () => {
  it('parses two positive integers', () => {
    expect(parseCompareQuery({ from: '1', to: '3' })).toEqual({ success: true, from: 1, to: 3 });
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parseCompareQuery({ from: ['2', '9'], to: '3' })).toEqual({
      success: true,
      from: 2,
      to: 3,
    });
  });

  it.each([
    [{}],
    [{ from: '1' }],
    [{ from: '0', to: '2' }],
    [{ from: '-1', to: '2' }],
    [{ from: '1.5', to: '2' }],
    [{ from: 'x', to: '2' }],
  ])('rejects %j', (query) => {
    const result = parseCompareQuery(query);
    expect(result.success).toBe(false);
  });
});
