import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { status: 'ok', uptimeSeconds: 12, timestamp: 'now', version: '0.1.0' },
          }),
      }),
    );
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
});
