import type { DifficultyDistribution as Distribution } from '@codereviewai/shared';

const ROWS: Array<{ key: keyof Distribution; tone: string }> = [
  { key: 'Easy', tone: 'good' },
  { key: 'Medium', tone: 'warn' },
  { key: 'Hard', tone: 'bad' },
  { key: 'Unknown', tone: 'neutral' },
];

/** Horizontal bars, one per difficulty, scaled to the largest bucket. No chart library needed. */
export function DifficultyDistribution({ distribution }: { distribution: Distribution }) {
  const max = Math.max(1, ...ROWS.map((row) => distribution[row.key]));
  const rows = ROWS.filter((row) => row.key !== 'Unknown' || distribution.Unknown > 0);

  return (
    <ul className="bar-list" aria-label="Difficulty distribution">
      {rows.map(({ key, tone }) => (
        <li key={key} className="bar-row">
          <span className="bar-label">{key}</span>
          <span className="bar-track">
            <span
              className={`bar-fill bar-${tone}`}
              data-testid={`bar-${key}`}
              style={{ width: `${(distribution[key] / max) * 100}%` }}
            />
          </span>
          <span className="bar-count">{distribution[key]}</span>
        </li>
      ))}
    </ul>
  );
}
