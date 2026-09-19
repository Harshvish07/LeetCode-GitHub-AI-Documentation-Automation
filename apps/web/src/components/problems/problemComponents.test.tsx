import type { ProblemListQuery } from '@codereviewai/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { problemItem } from '../../testing/fixtures.js';
import { ProblemFilters } from './ProblemFilters.js';
import { ProblemTable } from './ProblemTable.js';

describe('ProblemFilters', () => {
  it('reports the search text as the user types', async () => {
    const onChange = vi.fn();
    render(<ProblemFilters query={{}} onChange={onChange} />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'x');

    expect(onChange).toHaveBeenLastCalledWith({ search: 'x' });
  });

  it.each([
    ['Difficulty', 'Hard', { difficulty: 'Hard' }],
    ['Pattern', 'Two Pointers', { pattern: 'Two Pointers' }],
    ['Status', 'Wrong Answer', { status: 'Wrong Answer' }],
    ['Language', 'Python', { language: 'Python' }],
  ])('reports a %s selection', async (label, option, expected) => {
    const onChange = vi.fn();
    render(<ProblemFilters query={{}} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText(label), option);

    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('keeps existing filters and sort when one changes', async () => {
    const onChange = vi.fn();
    const query: ProblemListQuery = { difficulty: 'Easy', sortBy: 'title', sortOrder: 'asc' };
    render(<ProblemFilters query={query} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'Go');

    expect(onChange).toHaveBeenCalledWith({ ...query, language: 'Go' });
  });

  it('stores "All" as undefined, never as an empty string', async () => {
    const onChange = vi.fn();
    render(<ProblemFilters query={{ difficulty: 'Hard' }} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText('Difficulty'), 'All');

    expect(onChange).toHaveBeenCalledWith({ difficulty: undefined });
  });

  it('offers every tracked pattern as an option', () => {
    render(<ProblemFilters query={{}} onChange={() => {}} />);

    const options = within(screen.getByLabelText('Pattern')).getAllByRole('option');
    expect(options).toHaveLength(17); // All + 16
  });

  it('disables "Clear filters" until a filter is set, then clears filters but keeps the sort', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProblemFilters query={{ sortBy: 'title' }} onChange={onChange} />);
    expect(
      (screen.getByRole('button', { name: 'Clear filters' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(
      <ProblemFilters
        query={{ difficulty: 'Hard', search: 'x', sortBy: 'title', sortOrder: 'asc' }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onChange).toHaveBeenCalledWith({ sortBy: 'title', sortOrder: 'asc' });
  });

  it('does not submit the form (no page reload) on Enter', () => {
    render(<ProblemFilters query={{}} onChange={() => {}} />);

    const notPrevented = fireEvent.submit(screen.getByRole('search'));

    expect(notPrevented).toBe(false);
  });
});

describe('ProblemTable', () => {
  const problems = [
    problemItem(),
    problemItem({
      submissionId: 'sub-2',
      number: 15,
      title: '3Sum',
      difficulty: 'Medium',
      patterns: ['Two Pointers', 'Sorting'],
      language: 'Python',
      status: 'Wrong Answer',
      timeComplexity: 'O(n^2)',
      qualityScore: null,
      reviewed: false,
      githubUrl: 'https://github.com/me/journal/blob/main/x.md',
    }),
  ];

  it('shows every column for each problem', () => {
    render(<ProblemTable problems={problems} sortBy="date" sortOrder="desc" onSort={() => {}} />);

    const rows = screen.getAllByTestId('problem-row');
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    expect(first.getByRole('link', { name: 'Two Sum' }).getAttribute('href')).toBe(
      '#/problems/sub-1',
    );
    expect(first.getByText('Easy')).toBeDefined();
    expect(first.getByText('Hash Map')).toBeDefined();
    expect(first.getByText('JavaScript')).toBeDefined();
    expect(first.getByText('Accepted')).toBeDefined();
    expect(first.getByText('O(n)')).toBeDefined();
    expect(first.getByText('95')).toBeDefined();
    expect(first.getByText('Sep 19, 2026')).toBeDefined();
    expect(first.getByText('Not published')).toBeDefined();
  });

  it('shows several patterns, a dash for missing values, and a GitHub link when published', () => {
    render(<ProblemTable problems={problems} sortBy="date" sortOrder="desc" onSort={() => {}} />);

    const second = within(screen.getAllByTestId('problem-row')[1]!);
    expect(second.getByText('Two Pointers')).toBeDefined();
    expect(second.getByText('Sorting')).toBeDefined();
    expect(second.getByText('Not reviewed')).toBeDefined();
    const link = second.getByRole('link', { name: 'Document' });
    expect(link.getAttribute('href')).toBe('https://github.com/me/journal/blob/main/x.md');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('calls onSort with the column key when a sortable header is clicked', async () => {
    const onSort = vi.fn();
    render(<ProblemTable problems={problems} sortBy="date" sortOrder="desc" onSort={onSort} />);

    await userEvent.click(screen.getByRole('button', { name: 'Difficulty' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quality' }));

    expect(onSort).toHaveBeenNthCalledWith(1, 'difficulty');
    expect(onSort).toHaveBeenNthCalledWith(2, 'quality');
  });

  it('marks only the active column with aria-sort and a direction arrow', () => {
    const { rerender } = render(
      <ProblemTable problems={problems} sortBy="title" sortOrder="asc" onSort={() => {}} />,
    );

    const title = screen.getByRole('columnheader', { name: /Problem/ });
    expect(title.getAttribute('aria-sort')).toBe('ascending');
    expect(title.textContent).toContain('▲');
    expect(
      screen.getByRole('columnheader', { name: /Difficulty/ }).getAttribute('aria-sort'),
    ).toBeNull();

    rerender(
      <ProblemTable problems={problems} sortBy="title" sortOrder="desc" onSort={() => {}} />,
    );
    expect(screen.getByRole('columnheader', { name: /Problem/ }).getAttribute('aria-sort')).toBe(
      'descending',
    );
  });

  it('does not make the Pattern and GitHub columns sortable', () => {
    render(<ProblemTable problems={problems} sortBy="date" sortOrder="desc" onSort={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Pattern' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'GitHub' })).toBeNull();
  });

  it('shows an empty state when nothing matches', () => {
    render(<ProblemTable problems={[]} sortBy="date" sortOrder="desc" onSort={() => {}} />);

    expect(screen.getByText('No problems match these filters.')).toBeDefined();
    expect(screen.queryAllByTestId('problem-row')).toHaveLength(0);
  });
});
