import type { ProblemListItem } from '@codereviewai/shared';
import { applyProblemQuery } from '@codereviewai/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fail,
  mockApi,
  ok,
  patternStats,
  problemDetail,
  problemHistory,
  problemItem,
  summary,
} from '../testing/fixtures.js';
import { DashboardPage } from './DashboardPage.js';
import { ProblemDetailPage } from './ProblemDetailPage.js';
import { ProblemsPage } from './ProblemsPage.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DashboardPage', () => {
  it('shows the headline stats, difficulty distribution, recent problems, and pattern analytics', async () => {
    mockApi({
      '/api/dashboard/summary': ok(summary()),
      '/api/dashboard/patterns': ok(patternStats()),
    });

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByTestId('stat-Total problems').textContent).toBe('12'));
    expect(screen.getByTestId('stat-Current streak').textContent).toBe('4 days');
    expect(screen.getByRole('list', { name: 'Difficulty distribution' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Recent problems' })).toBeDefined();
    await screen.findByRole('table', { name: 'Pattern analytics' });
  });

  it('shows loading placeholders first', () => {
    mockApi({
      '/api/dashboard/summary': () => new Promise(() => {}),
      '/api/dashboard/patterns': () => new Promise(() => {}),
    });

    render(<DashboardPage />);

    expect(screen.getByText('Loading your progress…')).toBeDefined();
    expect(screen.getByText('Loading pattern analytics…')).toBeDefined();
  });

  it('shows the API error (e.g. no database configured) and lets the user retry', async () => {
    const fetchMock = mockApi({
      '/api/dashboard/summary': fail('The dashboard needs a database', 'DATABASE_NOT_CONFIGURED'),
      '/api/dashboard/patterns': ok(patternStats()),
    });

    render(<DashboardPage />);

    expect((await screen.findAllByRole('alert'))[0]!.textContent).toContain(
      'The dashboard needs a database',
    );
    const before = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });

  it('fails each panel independently', async () => {
    mockApi({
      '/api/dashboard/summary': ok(summary()),
      '/api/dashboard/patterns': fail('Patterns unavailable'),
    });

    render(<DashboardPage />);

    await screen.findByText('Patterns unavailable');
    expect(screen.getByTestId('stat-Total problems').textContent).toBe('12');
  });
});

describe('ProblemsPage', () => {
  const all: ProblemListItem[] = [
    problemItem(),
    problemItem({
      submissionId: 'sub-2',
      problemId: 'prob-2',
      number: 15,
      slug: '3sum',
      title: '3Sum',
      difficulty: 'Medium',
      patterns: ['Two Pointers'],
      status: 'Wrong Answer',
      qualityScore: 58,
      submittedAt: '2026-09-18T10:00:00.000Z',
    }),
  ];

  /** A fake API that applies the real shared filter/sort, so the page is tested end to end. */
  function serveProblems() {
    return mockApi({
      '/api/problems': (url: string) => {
        const params = new URL(url, 'http://x').searchParams;
        const query = Object.fromEntries(params.entries());
        return ok(applyProblemQuery(all, query as never));
      },
    });
  }

  it('loads the list newest-first by default', async () => {
    const fetchMock = serveProblems();

    render(<ProblemsPage />);

    await screen.findAllByTestId('problem-row');
    expect(fetchMock).toHaveBeenCalledWith('/api/problems?sortBy=date&sortOrder=desc');
    expect(screen.getByText('2 problems')).toBeDefined();
  });

  it('filters by difficulty through the API', async () => {
    const fetchMock = serveProblems();
    render(<ProblemsPage />);
    await screen.findAllByTestId('problem-row');

    await userEvent.selectOptions(screen.getByLabelText('Difficulty'), 'Medium');

    await waitFor(() => expect(screen.getAllByTestId('problem-row')).toHaveLength(1));
    expect(within(screen.getByTestId('problem-row')).getByText('3Sum')).toBeDefined();
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('difficulty=Medium'));
    expect(screen.getByText('1 problem')).toBeDefined();
  });

  it('searches as the user types', async () => {
    serveProblems();
    render(<ProblemsPage />);
    await screen.findAllByTestId('problem-row');

    await userEvent.type(screen.getByRole('searchbox'), 'two sum');

    await waitFor(() => expect(screen.getAllByTestId('problem-row')).toHaveLength(1));
    expect(within(screen.getByTestId('problem-row')).getByText('Two Sum')).toBeDefined();
  });

  it('sorts when a header is clicked, and flips direction on a second click', async () => {
    const fetchMock = serveProblems();
    render(<ProblemsPage />);
    await screen.findAllByTestId('problem-row');

    await userEvent.click(screen.getByRole('button', { name: 'Difficulty' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/api/problems?sortBy=difficulty&sortOrder=asc'),
    );
    const titles = () =>
      screen
        .getAllByTestId('problem-row')
        .map((row) => within(row).getAllByRole('link')[0]!.textContent);
    await waitFor(() => expect(titles()).toEqual(['Two Sum', '3Sum']));

    await userEvent.click(screen.getByRole('button', { name: /Difficulty/ }));
    await waitFor(() => expect(titles()).toEqual(['3Sum', 'Two Sum']));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/problems?sortBy=difficulty&sortOrder=desc');
  });

  it('shows an empty state when the filters match nothing, and clears them', async () => {
    serveProblems();
    render(<ProblemsPage />);
    await screen.findAllByTestId('problem-row');

    await userEvent.selectOptions(screen.getByLabelText('Language'), 'Rust');
    await screen.findByText('No problems match these filters.');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(screen.getAllByTestId('problem-row')).toHaveLength(2));
  });

  it('shows an error when the API fails', async () => {
    mockApi({ '/api/problems': fail('Boom') });

    render(<ProblemsPage />);

    expect((await screen.findByRole('alert')).textContent).toContain('Boom');
  });
});

describe('ProblemDetailPage', () => {
  it('shows every section for a fully reviewed, published problem', async () => {
    mockApi({
      '/api/problems/sub-1/history': ok(problemHistory()),
      '/api/problems/sub-1': ok(
        problemDetail({
          review: {
            ...problemDetail().review!,
            optimality: { isOptimal: false, reasoning: 'A map is faster.' },
            betterApproach: {
              description: 'Use a map.',
              pseudocode: '1. build map',
              code: 'const m = new Map();',
              complexity: { time: 'O(n)', space: 'O(n)' },
              whyBetter: 'Linear.',
            },
          },
        }),
      ),
    });

    render(<ProblemDetailPage submissionId="sub-1" />);

    await screen.findByRole('heading', { name: '1. Two Sum' });
    for (const title of [
      'Problem information',
      'Your solution',
      'Static analysis',
      'AI review',
      'Better approach',
      'Learning points',
      'GitHub document',
      'Submission history',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeDefined();
    }
    expect(screen.getByLabelText('Your submitted code').textContent).toContain('const seen');
    expect(screen.getByLabelText('Recommended code').textContent).toBe('const m = new Map();');
    expect(screen.getByRole('link', { name: '001-two-sum.md' })).toBeDefined();
    expect(screen.getByRole('link', { name: '← All problems' }).getAttribute('href')).toBe(
      '#/problems',
    );
  });

  it('handles a submission that was never reviewed or published', async () => {
    mockApi({
      '/api/problems/sub-9/history': ok(
        problemHistory({
          attempts: [problemHistory().attempts[0]!],
          comparisons: [],
          overview: {
            ...problemHistory().overview,
            attemptCount: 1,
            outcome: 'single-attempt',
            complexityJourney: [],
            explanation: [
              'Only one attempt has been recorded, so there is no improvement to describe yet.',
            ],
          },
        }),
      ),
      '/api/problems/sub-9': ok(
        problemDetail({ analysis: null, review: null, document: null, qualityScore: null }),
      ),
    });

    render(<ProblemDetailPage submissionId="sub-9" />);

    await screen.findByText(/Not analyzed yet/);
    expect(screen.getByText(/No AI review yet/)).toBeDefined();
    expect(screen.getByText(/No document has been generated/)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Better approach' })).toBeNull();
    await screen.findByText(/Only one attempt has been recorded/);
    expect(screen.queryByRole('list', { name: 'Attempt comparisons' })).toBeNull();
  });

  it('shows the API error for an unknown problem', async () => {
    mockApi({ '/api/problems/nope': fail('No problem found for submission "nope".', 'NOT_FOUND') });

    render(<ProblemDetailPage submissionId="nope" />);

    expect((await screen.findByRole('alert')).textContent).toContain('No problem found');
  });

  it('refetches when the submission id changes', async () => {
    const fetchMock = mockApi({
      '/api/problems/': (url: string) =>
        url.endsWith('/history') ? ok(problemHistory()) : ok(problemDetail({ submissionId: url })),
    });
    const { rerender } = render(<ProblemDetailPage submissionId="a" />);
    await screen.findByRole('heading', { name: '1. Two Sum' });

    rerender(<ProblemDetailPage submissionId="b" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/problems/b'));
  });
});
