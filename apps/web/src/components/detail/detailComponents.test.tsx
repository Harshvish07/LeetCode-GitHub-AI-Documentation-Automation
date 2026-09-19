import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { problemDetail } from '../../testing/fixtures.js';
import { AiReviewPanel } from './AiReviewPanel.js';
import { BetterApproachPanel } from './BetterApproachPanel.js';
import { GithubPanel } from './GithubPanel.js';
import { LearningPanel } from './LearningPanel.js';
import { ProblemInfo } from './ProblemInfo.js';
import { StaticAnalysisPanel } from './StaticAnalysisPanel.js';
import { SubmissionPanel } from './SubmissionPanel.js';

const detail = problemDetail();

describe('ProblemInfo', () => {
  it('shows number, title, difficulty, quality, description, and a LeetCode link', () => {
    render(<ProblemInfo detail={detail} />);

    expect(screen.getByRole('heading', { name: '1. Two Sum' })).toBeDefined();
    expect(screen.getByText('Easy')).toBeDefined();
    expect(screen.getByText('91')).toBeDefined();
    expect(screen.getByText(/Return indices of the two numbers/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open on LeetCode' }).getAttribute('href')).toBe(
      'https://leetcode.com/problems/two-sum/',
    );
  });
});

describe('SubmissionPanel', () => {
  it('shows the submitted code exactly, including characters that look like markup', () => {
    render(<SubmissionPanel detail={detail} />);

    const block = screen.getByLabelText('Your submitted code');
    expect(block.textContent).toBe(detail.submission.code);
    expect(block.querySelector('b')).toBeNull(); // "<b>bold</b>" is text, not an element
  });

  it('shows language, runtime, memory, date, and status', () => {
    render(<SubmissionPanel detail={detail} />);

    expect(screen.getByText('JavaScript')).toBeDefined();
    expect(screen.getByText('52 ms')).toBeDefined();
    expect(screen.getByText('42.1 MB')).toBeDefined();
    expect(screen.getByText('Sep 19, 2026')).toBeDefined();
    expect(screen.getByText('Accepted')).toBeDefined();
  });
});

describe('StaticAnalysisPanel', () => {
  it('shows complexity with confidence, patterns, quality observations, and edge cases', () => {
    render(<StaticAnalysisPanel analysis={detail.analysis} />);

    expect(screen.getAllByText('O(n)')).toHaveLength(2);
    expect(screen.getByText('Hash Map · high')).toBeDefined();
    expect(screen.getByText('Consider clearer names.')).toBeDefined();
    expect(screen.getByText('Empty input:')).toBeDefined();
  });

  it('explains when there is no analysis yet', () => {
    render(<StaticAnalysisPanel analysis={null} />);

    expect(screen.getByText(/Not analyzed yet/)).toBeDefined();
  });

  it('says so when no patterns were detected', () => {
    render(<StaticAnalysisPanel analysis={{ ...detail.analysis!, patterns: [] }} />);

    expect(screen.getByText('None detected.')).toBeDefined();
  });
});

describe('AiReviewPanel', () => {
  it('shows the approach, verdict, strengths, and improvements', () => {
    render(<AiReviewPanel review={detail.review} />);

    expect(screen.getByText('Single-pass hash map.')).toBeDefined();
    expect(screen.getByText('Optimal')).toBeDefined();
    expect(screen.getByText('Single pass')).toBeDefined();
    expect(screen.getByText('Validate input')).toBeDefined();
    expect(screen.queryByTestId('disagreement-notice')).toBeNull();
  });

  it('shows a "not optimal" verdict with its reasoning', () => {
    const review = {
      ...detail.review!,
      optimality: { isOptimal: false, reasoning: 'A map is faster.' },
    };
    render(<AiReviewPanel review={review} />);

    expect(screen.getByText('Not optimal')).toBeDefined();
    expect(screen.getByText(/A map is faster\./)).toBeDefined();
  });

  it('surfaces a disagreement with static analysis instead of hiding it', () => {
    const review = {
      ...detail.review!,
      agreement: {
        time: { matches: false, deterministic: 'O(n^2)', ai: 'O(n)' },
        space: { matches: true, deterministic: 'O(n)', ai: 'O(n)' },
        patternsAgreedOn: [],
        patternsOnlyInDeterministic: ['Sorting'],
        patternsOnlyInAi: ['Hash Map'],
        hasDisagreement: true,
      },
    };
    render(<AiReviewPanel review={review} />);

    const notice = within(screen.getByTestId('disagreement-notice'));
    expect(notice.getByText(/static: O\(n\^2\), AI: O\(n\)/)).toBeDefined();
    expect(notice.getByText(/Only the AI found: Hash Map/)).toBeDefined();
    expect(notice.getByText(/Only static analysis found: Sorting/)).toBeDefined();
  });

  it('lists correctness concerns when there are any', () => {
    const review = { ...detail.review!, correctnessConcerns: ['Overflows for huge inputs.'] };
    render(<AiReviewPanel review={review} />);

    expect(screen.getByText('Correctness concerns')).toBeDefined();
    expect(screen.getByText('Overflows for huge inputs.')).toBeDefined();
  });

  it('explains when there is no review yet', () => {
    render(<AiReviewPanel review={null} />);

    expect(screen.getByText(/No AI review yet/)).toBeDefined();
  });
});

describe('BetterApproachPanel', () => {
  const better = {
    description: 'Use a hash map.',
    pseudocode: '1. build map',
    code: 'const m = new Map();',
    complexity: { time: 'O(n)', space: 'O(n)' },
    whyBetter: 'Linear time.',
  };

  it('labels the suggestion as RECOMMENDED, separate from the user code, with pseudocode and code', () => {
    render(<BetterApproachPanel review={{ ...detail.review!, betterApproach: better }} />);

    expect(screen.getByText(/RECOMMENDED SOLUTION/)).toBeDefined();
    expect(screen.getByLabelText('Recommended pseudocode').textContent).toBe('1. build map');
    expect(screen.getByLabelText('Recommended code').textContent).toBe('const m = new Map();');
    expect(screen.getByText('Linear time.')).toBeDefined();
  });

  it('says so explicitly when the solution is already optimal', () => {
    render(<BetterApproachPanel review={detail.review} />);

    expect(screen.getByText(/already optimal/)).toBeDefined();
  });

  it('renders nothing without a review', () => {
    const { container } = render(<BetterApproachPanel review={null} />);

    expect(container.textContent).toBe('');
  });
});

describe('LearningPanel', () => {
  it('shows learning points and related patterns', () => {
    render(<LearningPanel review={detail.review} />);

    expect(screen.getByText('Trade space for time.')).toBeDefined();
    expect(screen.getByText('Two Pointers')).toBeDefined();
  });

  it('renders nothing without a review', () => {
    const { container } = render(<LearningPanel review={null} />);

    expect(container.textContent).toBe('');
  });
});

describe('GithubPanel', () => {
  it('links to the published document', () => {
    render(<GithubPanel document={detail.document} />);

    const link = screen.getByRole('link', { name: '001-two-sum.md' });
    expect(link.getAttribute('href')).toBe(detail.document!.githubUrl);
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(/published Sep 19, 2026/)).toBeDefined();
  });

  it('explains a generated-but-unpublished document', () => {
    render(<GithubPanel document={{ filename: 'a.md', githubUrl: null, publishedAt: null }} />);

    expect(screen.getByText(/a\.md has been generated but not published/)).toBeDefined();
  });

  it('explains when there is no document at all', () => {
    render(<GithubPanel document={null} />);

    expect(screen.getByText(/No document has been generated/)).toBeDefined();
  });
});
