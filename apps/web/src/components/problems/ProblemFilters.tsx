import {
  LEETCODE_LANGUAGES,
  LEETCODE_SUBMISSION_STATUSES,
  TRACKED_PATTERNS,
  type ProblemListQuery,
} from '@codereviewai/shared';

export interface ProblemFiltersProps {
  query: ProblemListQuery;
  onChange: (query: ProblemListQuery) => void;
}

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;

/**
 * The problem list's search box and filter dropdowns. Controlled: it owns no
 * state, just reports the next query up — the page decides what to fetch.
 * An empty selection is stored as `undefined`, never as an empty string.
 */
export function ProblemFilters({ query, onChange }: ProblemFiltersProps) {
  const set = <K extends keyof ProblemListQuery>(key: K, value: string) =>
    onChange({ ...query, [key]: value === '' ? undefined : value });

  const hasFilters = Boolean(
    query.search || query.difficulty || query.pattern || query.status || query.language,
  );

  return (
    <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <label className="field field-wide">
        <span>Search</span>
        <input
          type="search"
          value={query.search ?? ''}
          placeholder="Title, number, or pattern"
          onChange={(event) => set('search', event.target.value)}
        />
      </label>

      <Select
        label="Difficulty"
        value={query.difficulty}
        options={DIFFICULTIES}
        onChange={(v) => set('difficulty', v)}
      />
      <Select
        label="Pattern"
        value={query.pattern}
        options={TRACKED_PATTERNS}
        onChange={(v) => set('pattern', v)}
      />
      <Select
        label="Status"
        value={query.status}
        options={LEETCODE_SUBMISSION_STATUSES}
        onChange={(v) => set('status', v)}
      />
      <Select
        label="Language"
        value={query.language}
        options={LEETCODE_LANGUAGES}
        onChange={(v) => set('language', v)}
      />

      <button
        type="button"
        className="button"
        disabled={!hasFilters}
        onClick={() => onChange({ sortBy: query.sortBy, sortOrder: query.sortOrder })}
      >
        Clear filters
      </button>
    </form>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
