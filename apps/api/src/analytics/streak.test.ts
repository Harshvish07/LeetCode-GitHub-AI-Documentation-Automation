import { describe, expect, it } from 'vitest';
import { computeStreaks } from './streak.js';

const NOW = new Date('2026-09-19T15:00:00.000Z');

describe('computeStreaks', () => {
  it('is zero with no activity', () => {
    expect(computeStreaks([], NOW)).toEqual({ current: 0, longest: 0 });
  });

  it('counts a streak ending today', () => {
    const result = computeStreaks(
      ['2026-09-17T08:00:00Z', '2026-09-18T09:00:00Z', '2026-09-19T10:00:00Z'],
      NOW,
    );
    expect(result).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive when the last activity was yesterday', () => {
    const result = computeStreaks(['2026-09-17T08:00:00Z', '2026-09-18T09:00:00Z'], NOW);
    expect(result.current).toBe(2);
  });

  it('resets the current streak after a missed day, but remembers the longest', () => {
    const result = computeStreaks(
      [
        '2026-09-10T08:00:00Z',
        '2026-09-11T08:00:00Z',
        '2026-09-12T08:00:00Z',
        '2026-09-16T08:00:00Z',
      ],
      NOW,
    );
    expect(result).toEqual({ current: 0, longest: 3 });
  });

  it('counts multiple submissions on one day once', () => {
    const result = computeStreaks(
      ['2026-09-19T01:00:00Z', '2026-09-19T05:00:00Z', '2026-09-19T23:59:00Z'],
      NOW,
    );
    expect(result).toEqual({ current: 1, longest: 1 });
  });

  it('handles a streak crossing a month boundary', () => {
    const result = computeStreaks(
      ['2026-08-30T08:00:00Z', '2026-08-31T08:00:00Z', '2026-09-01T08:00:00Z'],
      new Date('2026-09-01T12:00:00Z'),
    );
    expect(result).toEqual({ current: 3, longest: 3 });
  });

  it('accepts Date objects and ignores invalid dates', () => {
    const result = computeStreaks([new Date('2026-09-19T01:00:00Z'), 'not a date'], NOW);
    expect(result).toEqual({ current: 1, longest: 1 });
  });
});
