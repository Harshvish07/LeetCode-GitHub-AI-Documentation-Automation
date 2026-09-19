import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fail,
  learningProfile,
  mockApi,
  ok,
  problemDetail,
  problemHistory,
  recommendations,
} from '../testing/fixtures.js';
import { LearningPage } from './LearningPage.js';
import { ProblemDetailPage } from './ProblemDetailPage.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProblemDetailPage — submission history', () => {
  it('shows the improvement story, every attempt, and each comparison', async () => {
    mockApi({
      '/api/problems/sub-1/history': ok(problemHistory()),
      '/api/problems/sub-1': ok(problemDetail()),
    });

    render(<ProblemDetailPage submissionId="sub-1" />);

    await screen.findByText('Improved');
    expect(screen.getByLabelText('Complexity journey').textContent).toContain('O(n^2) → O(n)');
    const attempts = within(screen.getByRole('list', { name: 'Attempts' })).getAllByRole(
      'listitem',
    );
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.textContent).toContain('Attempt 1');
    expect(attempts[0]!.textContent).toContain('Wrong Answer');
    expect(attempts[1]!.textContent).toContain('Accepted');
    const comparisons = screen.getByRole('list', { name: 'Attempt comparisons' });
    expect(comparisons.textContent).toContain('Attempt 1 → 2');
    expect(comparisons.textContent).toContain('Bug fixed');
    expect(comparisons.textContent).toContain('Time complexity improved from O(n^2) to O(n).');
  });

  it('shows code as text, never as markup', async () => {
    mockApi({
      '/api/problems/sub-1/history': ok(problemHistory()),
      '/api/problems/sub-1': ok(problemDetail()),
    });

    render(<ProblemDetailPage submissionId="sub-1" />);

    const code = await screen.findByLabelText('Code of attempt 1');
    expect(code.textContent).toContain('<i>x</i>');
    expect(code.querySelector('i')).toBeNull();
  });

  it('marks unreviewed attempts instead of showing invented data', async () => {
    const history = problemHistory();
    history.attempts[0] = {
      ...history.attempts[0]!,
      reviewed: false,
      timeComplexity: null,
      qualityScore: null,
      approach: null,
    };
    mockApi({
      '/api/problems/sub-1/history': ok(history),
      '/api/problems/sub-1': ok(problemDetail()),
    });

    render(<ProblemDetailPage submissionId="sub-1" />);

    await screen.findByText('No AI review for this attempt.');
  });

  it('fails independently: a history error leaves the rest of the page intact', async () => {
    mockApi({
      '/api/problems/sub-1/history': fail('History unavailable'),
      '/api/problems/sub-1': ok(problemDetail()),
    });

    render(<ProblemDetailPage submissionId="sub-1" />);

    expect((await screen.findByRole('alert')).textContent).toContain('History unavailable');
    expect(screen.getByRole('heading', { name: 'Your solution' })).toBeDefined();
  });
});

describe('LearningPage', () => {
  it('shows recommendations, weaknesses with evidence, strengths, and pattern levels', async () => {
    mockApi({
      '/api/learning/profile': ok(learningProfile()),
      '/api/learning/recommendations': ok(recommendations()),
    });

    render(<LearningPage />);

    await screen.findByText('Practice more: Sliding Window. Review: Graph.');
    expect(screen.getByRole('list', { name: 'Practice more' }).textContent).toContain(
      'Sliding Window',
    );
    expect(screen.getByRole('list', { name: 'Review' }).textContent).toContain('Graph');

    const weaknesses = await screen.findByRole('list', { name: 'Recurring weaknesses' });
    expect(weaknesses.textContent).toContain('Repeated Time Limit Exceeded');
    expect(weaknesses.textContent).toContain('3 of 7');
    expect(within(weaknesses).getByRole('link', { name: 'Trap Water' }).getAttribute('href')).toBe(
      '#/problems/sub-9',
    );
    expect(screen.getByRole('list', { name: 'Strengths' }).textContent).toContain('Hash Map');

    const table = screen.getByRole('table', { name: 'Pattern levels' });
    expect(within(table).getByText('strong')).toBeDefined();
    expect(screen.getByRole('list', { name: 'Limitations of this profile' })).toBeDefined();
  });

  it('handles an empty history without inventing anything', async () => {
    mockApi({
      '/api/learning/profile': ok(
        learningProfile({
          problems: 0,
          attempts: 0,
          reviewedAttempts: 0,
          sufficientData: false,
          insights: [],
          patterns: learningProfile().patterns.map((p) => ({
            ...p,
            problems: 0,
            accepted: 0,
            averageQuality: null,
            level: 'untouched' as const,
          })),
          notes: ['No submissions have been recorded yet.'],
        }),
      ),
      '/api/learning/recommendations': ok(
        recommendations({
          practiceMore: [],
          review: [],
          sufficientData: false,
          summary: 'No submissions recorded yet, so there is nothing to base recommendations on.',
        }),
      ),
    });

    render(<LearningPage />);

    await screen.findByText(/nothing to base recommendations on/);
    expect(
      await screen.findByText('No recurring weakness is supported by your history yet.'),
    ).toBeDefined();
    expect(screen.getByText('No strength is supported by your history yet.')).toBeDefined();
    expect(screen.getByText(/No reviewed solutions with a recognized pattern yet/)).toBeDefined();
    expect(screen.getAllByText('Nothing to suggest here right now.')).toHaveLength(2);
    expect(screen.queryByRole('table', { name: 'Pattern levels' })).toBeNull();
  });

  it('shows the API error (no database) on both panels and lets the user retry', async () => {
    const fetchMock = mockApi({
      '/api/learning/profile': fail('Set DATABASE_URL', 'DATABASE_NOT_CONFIGURED'),
      '/api/learning/recommendations': fail('Set DATABASE_URL', 'DATABASE_NOT_CONFIGURED'),
    });

    render(<LearningPage />);

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    const before = fetchMock.mock.calls.length;
    await userEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]!);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });
});
