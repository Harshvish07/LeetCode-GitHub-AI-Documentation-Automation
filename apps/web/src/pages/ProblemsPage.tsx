import type { ProblemListQuery, ProblemSortKey } from '@codereviewai/shared';
import { useState } from 'react';
import { dashboardApi } from '../api/dashboardApi.js';
import { Loadable } from '../components/common/LoadState.js';
import { Section } from '../components/common/Section.js';
import { ProblemFilters } from '../components/problems/ProblemFilters.js';
import { ProblemTable } from '../components/problems/ProblemTable.js';
import { useAsync } from '../hooks/useAsync.js';

const DEFAULT_QUERY: ProblemListQuery = { sortBy: 'date', sortOrder: 'desc' };

/** The searchable, filterable, sortable problem list. The query is the page's only state; every change refetches from the API. */
export function ProblemsPage() {
  const [query, setQuery] = useState<ProblemListQuery>(DEFAULT_QUERY);
  const problems = useAsync(() => dashboardApi.listProblems(query), [JSON.stringify(query)]);

  const sortBy = query.sortBy ?? 'date';
  const sortOrder = query.sortOrder ?? 'desc';

  const handleSort = (key: ProblemSortKey) => {
    // Clicking the active column flips its direction; a new column starts ascending
    // (newest-first for dates, which is the more useful default there).
    if (key === sortBy) {
      setQuery({ ...query, sortBy: key, sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setQuery({ ...query, sortBy: key, sortOrder: key === 'date' ? 'desc' : 'asc' });
    }
  };

  return (
    <div className="page-stack">
      <Section title="Problems">
        <ProblemFilters query={query} onChange={setQuery} />
        <Loadable state={problems} what="problems" onRetry={problems.reload}>
          {(items) => (
            <>
              <p className="result-count" aria-live="polite">
                {items.length} {items.length === 1 ? 'problem' : 'problems'}
              </p>
              <ProblemTable
                problems={items}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </>
          )}
        </Loadable>
      </Section>
    </div>
  );
}
