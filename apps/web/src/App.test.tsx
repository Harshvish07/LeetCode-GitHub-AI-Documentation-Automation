import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import {
  HEALTH,
  mockApi,
  ok,
  patternStats,
  learningProfile,
  problemDetail,
  problemHistory,
  problemItem,
  recommendations,
  summary,
} from './testing/fixtures.js';

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
    mockApi({
      '/api/health': HEALTH,
      '/api/dashboard/summary': ok(summary()),
      '/api/dashboard/patterns': ok(patternStats()),
      '/api/problems/sub-1/history': ok(problemHistory()),
      '/api/problems/sub-1': ok(problemDetail()),
      '/api/learning/profile': ok(learningProfile()),
      '/api/learning/recommendations': ok(recommendations()),
      '/api/problems': ok([problemItem()]),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the project title and tagline', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'CodeReviewAI' })).toBeDefined();
    expect(screen.getByText('AI-Powered LeetCode Solution Analyzer')).toBeDefined();
  });

  it('shows the backend status once the health check resolves', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-status').textContent).toContain('online (uptime 12s)');
    });
  });

  it('shows the dashboard by default and marks it as the current page', async () => {
    render(<App />);

    await screen.findByTestId('stat-Total problems');
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('link', { name: 'Problems' }).getAttribute('aria-current')).toBeNull();
  });

  it('navigates to the problem list when the hash changes', async () => {
    render(<App />);
    await screen.findByTestId('stat-Total problems');

    window.location.hash = '#/problems';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await screen.findByRole('table', { name: 'Problems' });
    expect(screen.getByRole('link', { name: 'Problems' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('shows a problem detail page for #/problems/<id>', async () => {
    window.location.hash = '#/problems/sub-1';

    render(<App />);

    await screen.findByRole('heading', { name: '1. Two Sum' });
    expect(screen.getByRole('link', { name: 'Problems' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('shows a not-found message for an unknown route', () => {
    window.location.hash = '#/nowhere';

    render(<App />);

    expect(screen.getByText(/Page not found/)).toBeDefined();
  });
});
