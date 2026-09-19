export interface Streaks {
  current: number;
  longest: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDay(key: string, days: number): string {
  return dayKey(new Date(Date.parse(`${key}T00:00:00.000Z`) + days * DAY_MS));
}

/**
 * Consecutive-day activity streaks, over UTC calendar days (documented in
 * docs/database.md — a per-user timezone would need Phase 9's accounts).
 *
 * `current` counts back from today; if there's no activity today but there
 * was yesterday, the streak is still alive (you haven't *missed* a day yet),
 * so it counts back from yesterday instead. `now` is injected so the result
 * is deterministic in tests.
 */
export function computeStreaks(activity: Iterable<Date | string>, now: Date): Streaks {
  const days = new Set<string>();
  for (const item of activity) {
    const date = typeof item === 'string' ? new Date(item) : item;
    if (!Number.isNaN(date.getTime())) days.add(dayKey(date));
  }
  if (days.size === 0) return { current: 0, longest: 0 };

  const today = dayKey(now);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest };
}
