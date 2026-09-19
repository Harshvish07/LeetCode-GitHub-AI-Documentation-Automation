import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { patternStats, problemItem, summary } from '../../testing/fixtures.js';
import { StatCard } from '../common/StatCard.js';
import { DifficultyDistribution } from './DifficultyDistribution.js';
import { PatternAnalytics } from './PatternAnalytics.js';
import { RecentProblems } from './RecentProblems.js';
import { StatGrid } from './StatGrid.js';

describe('StatCard', () => {
  it('shows the value, label, and optional hint', () => {
    render(<StatCard label="Accepted" value={9} hint="of 12" />);

    expect(screen.getByTestId('stat-Accepted').textContent).toBe('9');
    expect(screen.getByText('Accepted')).toBeDefined();
    expect(screen.getByText('of 12')).toBeDefined();
  });

  it('omits the hint when none is given', () => {
    render(<StatCard label="Optimal" value={5} />);

    expect(screen.queryByText('of 12')).toBeNull();
  });
});

describe('StatGrid', () => {
  it('shows every headline statistic from the summary', () => {
    render(<StatGrid summary={summary()} />);

    expect(screen.getByTestId('stat-Total problems').textContent).toBe('12');
    expect(screen.getByTestId('stat-Accepted').textContent).toBe('9');
    expect(screen.getByTestId('stat-Needs improvement').textContent).toBe('4');
    expect(screen.getByTestId('stat-Optimal').textContent).toBe('5');
    expect(screen.getByTestId('stat-Current streak').textContent).toBe('4 days');
    expect(screen.getByTestId('stat-Patterns practiced').textContent).toBe('6');
  });

  it('mentions unreviewed submissions and the longest streak in hints', () => {
    render(<StatGrid summary={summary({ unreviewed: 3, longestStreak: 7 })} />);

    expect(screen.getByText('3 not reviewed yet')).toBeDefined();
    expect(screen.getByText('Longest: 7 days')).toBeDefined();
  });

  it('uses the singular "day" for a one-day streak and hides empty hints', () => {
    render(<StatGrid summary={summary({ currentStreak: 1, longestStreak: 0, unreviewed: 0 })} />);

    expect(screen.getByTestId('stat-Current streak').textContent).toBe('1 day');
    expect(screen.queryByText(/not reviewed yet/)).toBeNull();
    expect(screen.queryByText(/Longest/)).toBeNull();
  });
});

describe('DifficultyDistribution', () => {
  it('shows a count for each difficulty', () => {
    render(<DifficultyDistribution distribution={{ Easy: 6, Medium: 4, Hard: 2, Unknown: 0 }} />);

    const list = screen.getByRole('list', { name: 'Difficulty distribution' });
    expect(within(list).getByText('Easy').nextSibling?.nextSibling?.textContent).toBe('6');
    expect(within(list).getByText('Hard').nextSibling?.nextSibling?.textContent).toBe('2');
  });

  it('scales bars relative to the largest bucket', () => {
    render(<DifficultyDistribution distribution={{ Easy: 8, Medium: 4, Hard: 0, Unknown: 0 }} />);

    expect(screen.getByTestId('bar-Easy').style.width).toBe('100%');
    expect(screen.getByTestId('bar-Medium').style.width).toBe('50%');
    expect(screen.getByTestId('bar-Hard').style.width).toBe('0%');
  });

  it('hides the Unknown row unless something is unknown', () => {
    const { rerender } = render(
      <DifficultyDistribution distribution={{ Easy: 1, Medium: 0, Hard: 0, Unknown: 0 }} />,
    );
    expect(screen.queryByText('Unknown')).toBeNull();

    rerender(<DifficultyDistribution distribution={{ Easy: 1, Medium: 0, Hard: 0, Unknown: 2 }} />);
    expect(screen.getByText('Unknown')).toBeDefined();
  });

  it('does not divide by zero when everything is empty', () => {
    render(<DifficultyDistribution distribution={{ Easy: 0, Medium: 0, Hard: 0, Unknown: 0 }} />);

    expect(screen.getByTestId('bar-Easy').style.width).toBe('0%');
  });
});

describe('PatternAnalytics', () => {
  it('renders a row for every tracked pattern', () => {
    render(<PatternAnalytics stats={patternStats()} />);

    expect(screen.getByRole('table', { name: 'Pattern analytics' })).toBeDefined();
    expect(screen.getAllByRole('row')).toHaveLength(17); // header + 16 patterns
  });

  it('shows solved count, average quality, and improvement opportunities', () => {
    render(<PatternAnalytics stats={patternStats()} />);

    const row = screen.getByTestId('pattern-Hash Map');
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]!.textContent).toBe('5');
    expect(cells[1]!.textContent).toBe('91.5');
    expect(cells[2]!.textContent).toBe('2');
  });

  it('links to the problems most worth revisiting', () => {
    render(<PatternAnalytics stats={patternStats()} />);

    const link = within(screen.getByTestId('pattern-Hash Map')).getByRole('link', { name: '3Sum' });
    expect(link.getAttribute('href')).toBe('#/problems/sub-2');
  });

  it('dims patterns with no solutions and shows a dash for missing quality', () => {
    render(<PatternAnalytics stats={patternStats()} />);

    const row = screen.getByTestId('pattern-Heap');
    expect(row.className).toContain('row-dim');
    expect(within(row).getAllByRole('cell')[1]!.textContent).toBe('—');
  });
});

describe('RecentProblems', () => {
  it('lists recent problems with links, difficulty, status, and quality', () => {
    render(<RecentProblems problems={summary().recentProblems} />);

    const list = screen.getByRole('list', { name: 'Recent problems' });
    const link = within(list).getByRole('link', { name: '1. Two Sum' });
    expect(link.getAttribute('href')).toBe('#/problems/sub-1');
    expect(within(list).getByText('Easy')).toBeDefined();
    expect(within(list).getByText('Wrong Answer')).toBeDefined();
    expect(within(list).getByText('58')).toBeDefined();
  });

  it('shows "Not reviewed" for an unreviewed problem', () => {
    render(<RecentProblems problems={[problemItem({ qualityScore: null, reviewed: false })]} />);

    expect(screen.getByText('Not reviewed')).toBeDefined();
  });

  it('shows a friendly empty state', () => {
    render(<RecentProblems problems={[]} />);

    expect(screen.getByText(/No problems yet/)).toBeDefined();
  });
});
