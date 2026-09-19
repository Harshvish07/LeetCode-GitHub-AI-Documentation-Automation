import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { LeetCodeProblemInfo, LeetCodeSubmissionInfo } from '@codereviewai/shared';
import { describe, expect, it } from 'vitest';
import type { CombinedSolutionReview } from '../ai/types.js';
import type { SolutionReview } from '../ai/schemas/solutionReview.schema.js';
import { buildProblemHistory } from '../analytics/comparison.js';
import { attemptRecord } from '../testing/attemptFixtures.js';
import { generateDocument } from './document-generator.js';
import type { DocumentGenerationInput } from './types.js';

function confidence(level: 'low' | 'medium' | 'high' = 'high') {
  return { level, score: 0.8, reason: 'test' };
}

function problem(overrides: Partial<LeetCodeProblemInfo> = {}): LeetCodeProblemInfo {
  return {
    url: 'https://leetcode.com/problems/two-sum/',
    slug: 'two-sum',
    number: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    description:
      'Given an array of integers, return indices of the two numbers that add up to target.',
    ...overrides,
  };
}

function submission(overrides: Partial<LeetCodeSubmissionInfo> = {}): LeetCodeSubmissionInfo {
  return {
    language: 'JavaScript',
    code: 'var twoSum = function(nums, target) {\n  return [];\n};',
    status: 'Accepted',
    runtime: '52 ms',
    memory: '42.1 MB',
    ...overrides,
  };
}

function deterministic(overrides: Partial<SolutionAnalysis> = {}): SolutionAnalysis {
  return {
    detectedLanguage: 'JavaScript',
    detectedPatterns: [{ pattern: 'Hash Map', confidence: confidence(), evidence: ['new Map('] }],
    estimatedTimeComplexity: {
      notation: 'O(n)',
      confidence: confidence(),
      reasoning: ['single loop'],
    },
    estimatedSpaceComplexity: {
      notation: 'O(n)',
      confidence: confidence(),
      reasoning: ['hash map'],
    },
    algorithmCharacteristics: {
      usesRecursion: false,
      usesIteration: true,
      maxLoopNestingDepth: 1,
      usesSorting: false,
      usesHashing: true,
      usesExtraLinearStructure: true,
    },
    possibleIssues: [],
    codeQualityObservations: [],
    edgeCaseObservations: [],
    confidence: confidence(),
    ...overrides,
  };
}

function aiReview(overrides: Partial<SolutionReview> = {}): SolutionReview {
  return {
    problemSummary: 'Find two numbers that sum to a target.',
    userApproach: 'Single-pass hash map lookup.',
    patterns: ['Hash Map'],
    whyItWorks: 'Each complement is checked against previously seen numbers in O(1).',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['Single pass', 'Clear naming'],
    improvements: ['Add input validation.'],
    correctnessConcerns: [],
    edgeCases: ['Empty array', 'No valid pair exists'],
    optimality: { isOptimal: true, reasoning: 'Linear time is optimal for this problem.' },
    betterApproach: null,
    alternativeApproaches: ['Sort + two pointers, O(n log n)'],
    learningPoints: ['Hash maps trade space for time to avoid nested loops.'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
    ...overrides,
  };
}

function combinedReview(overrides: Partial<CombinedSolutionReview> = {}): CombinedSolutionReview {
  const det = overrides.deterministic ?? deterministic();
  const ai = overrides.ai ?? aiReview();
  return {
    submissionId: 'sub-123',
    deterministic: det,
    ai,
    agreement: {
      time: {
        matches: true,
        deterministic: det.estimatedTimeComplexity.notation,
        ai: ai.complexity.time,
      },
      space: {
        matches: true,
        deterministic: det.estimatedSpaceComplexity.notation,
        ai: ai.complexity.space,
      },
      patternsAgreedOn: ['Hash Map'],
      patternsOnlyInDeterministic: [],
      patternsOnlyInAi: [],
      hasDisagreement: false,
    },
    generatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

function input(overrides: Partial<DocumentGenerationInput> = {}): DocumentGenerationInput {
  return {
    problem: problem(),
    submission: submission(),
    review: combinedReview(),
    ...overrides,
  };
}

const REQUIRED_HEADINGS = [
  '# LeetCode Problem',
  '## Problem Information',
  '## Problem Understanding',
  '## My Solution',
  '## My Approach',
  '## DSA Pattern Used',
  '## Why My Solution Works',
  '## Complexity Analysis',
  '## What I Did Well',
  '## What Can Be Improved',
  '## Is My Solution Optimal?',
  '## Better Approach',
  '## Alternative Approaches',
  '## Edge Cases',
  '## Interview Explanation',
  '## Key Learning',
  '## Related Problems / Patterns',
  '## Personal Review',
];

describe('generateDocument — required sections', () => {
  it('includes every required section heading', () => {
    const { content } = generateDocument(input());
    for (const h of REQUIRED_HEADINGS) {
      expect(content).toContain(h);
    }
  });

  it('renders sections in the specified order', () => {
    const { content } = generateDocument(input());
    const indices = REQUIRED_HEADINGS.map((h) => content.indexOf(h));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]!);
    }
  });
});

describe('generateDocument — title', () => {
  it('uses the problem title in the H1', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('# LeetCode Problem: Two Sum');
  });

  it('falls back to the slug when title is null', () => {
    const { content } = generateDocument(input({ problem: problem({ title: null }) }));
    expect(content).toContain('# LeetCode Problem: two-sum');
  });
});

describe('generateDocument — exact code preservation', () => {
  it('includes the submitted code byte-for-byte, unmodified', () => {
    const code =
      'var twoSum = function(nums, target) {\n  // a comment with "quotes" and \\backslashes\\\n  return [];\n};';
    const { content } = generateDocument(input({ submission: submission({ code }) }));
    expect(content).toContain(code);
  });

  it('labels the submitted code as YOUR SOLUTION', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('YOUR SOLUTION');
  });

  it('never lets the recommended solution be confused with the submitted one', () => {
    const review = combinedReview({
      ai: aiReview({
        optimality: { isOptimal: false, reasoning: 'A hash map achieves linear time.' },
        betterApproach: {
          description: 'Use a hash map for O(n) lookups.',
          pseudocode:
            '1. Build a map of value -> index.\n2. For each element, check for its complement.',
          code: 'function twoSumFast(nums, target) { /* hash map version */ }',
          complexity: { time: 'O(n)', space: 'O(n)' },
          whyBetter: 'Avoids the nested loop entirely.',
        },
      }),
    });
    const { content } = generateDocument(input({ review }));

    expect(content).toContain('RECOMMENDED SOLUTION');
    expect(content).toContain('function twoSumFast');
    // the submitted code must still be present, unreplaced
    expect(content).toContain('var twoSum = function(nums, target)');
    const yourIndex = content.indexOf('YOUR SOLUTION');
    const recommendedIndex = content.indexOf('RECOMMENDED SOLUTION');
    expect(yourIndex).toBeGreaterThanOrEqual(0);
    expect(recommendedIndex).toBeGreaterThan(yourIndex);
  });

  it('preserves code containing a run of backticks without breaking its fence', () => {
    const code = 'const s = `template ${1}`;\n```\nlooks like a fence\n```';
    const { content } = generateDocument(input({ submission: submission({ code }) }));
    expect(content).toContain(code);
  });
});

describe('generateDocument — complexity', () => {
  it('includes the static estimate and the AI assessment', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('Static Analysis Estimate');
    expect(content).toContain('AI Assessment');
    expect(content).toContain('O(n)');
  });

  it('includes LeetCode-reported runtime and memory', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('52 ms');
    expect(content).toContain('42.1 MB');
  });

  it('surfaces a disagreement rather than hiding it', () => {
    const det = deterministic({
      estimatedTimeComplexity: {
        notation: 'O(n^2)',
        confidence: confidence(),
        reasoning: ['nested loops'],
      },
    });
    const ai = aiReview({ complexity: { time: 'O(n)', space: 'O(n)' } });
    const review = combinedReview({
      deterministic: det,
      ai,
      agreement: {
        time: { matches: false, deterministic: 'O(n^2)', ai: 'O(n)' },
        space: { matches: true, deterministic: 'O(n)', ai: 'O(n)' },
        patternsAgreedOn: [],
        patternsOnlyInDeterministic: [],
        patternsOnlyInAi: [],
        hasDisagreement: true,
      },
    });

    const { content } = generateDocument(input({ review }));

    expect(content).toContain('Disagreement detected');
    expect(content).toContain('O(n^2)');
    expect(content).toContain('disagreed on at least one point');
  });

  it('shows agreement clearly when both analyses match', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('Static analysis and the AI review agree');
  });
});

describe('generateDocument — AI analysis content', () => {
  it('includes the AI approach, why-it-works, strengths, and learning points', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('Single-pass hash map lookup.');
    expect(content).toContain('Each complement is checked against previously seen numbers');
    expect(content).toContain('Clear naming');
    expect(content).toContain('Hash maps trade space for time');
  });

  it('answers "is my solution optimal" clearly', () => {
    const { content: optimalContent } = generateDocument(
      input({
        review: combinedReview({
          ai: aiReview({ optimality: { isOptimal: true, reasoning: 'r' } }),
        }),
      }),
    );
    expect(optimalContent).toMatch(/\*\*Yes\.\*\*/);

    const { content: notOptimalContent } = generateDocument(
      input({
        review: combinedReview({
          ai: aiReview({ optimality: { isOptimal: false, reasoning: 'r' } }),
        }),
      }),
    );
    expect(notOptimalContent).toMatch(/\*\*No\.\*\*/);
  });
});

describe('generateDocument — missing optional fields', () => {
  it('states explicitly when no better approach exists', () => {
    const { content } = generateDocument(
      input({ review: combinedReview({ ai: aiReview({ betterApproach: null }) }) }),
    );
    expect(content).toContain('No better asymptotic approach exists');
  });

  it('falls back cleanly when problem.difficulty/description and submission.runtime/memory are null', () => {
    const { content } = generateDocument(
      input({
        problem: problem({ difficulty: null, description: null }),
        submission: submission({ runtime: null, memory: null }),
      }),
    );
    expect(content).toContain('Unknown');
    expect(content).toContain('Not recorded');
  });

  it('falls back cleanly when arrays are empty (strengths, improvements, edge cases, alternatives)', () => {
    const { content } = generateDocument(
      input({
        review: combinedReview({
          ai: aiReview({
            strengths: [],
            improvements: [],
            correctnessConcerns: [],
            edgeCases: [],
            alternativeApproaches: [],
            relatedPatterns: [],
          }),
        }),
      }),
    );
    expect(content).toContain('No particular strengths were highlighted.');
    expect(content).toContain('No specific improvements were identified.');
    expect(content).toContain('No notable alternative approaches');
    expect(content).toContain('No specific related patterns were suggested.');
  });

  it('omits the original problem statement block when description is null', () => {
    const { content } = generateDocument(input({ problem: problem({ description: null }) }));
    expect(content).not.toContain('Original problem statement');
  });
});

describe('generateDocument — special Markdown characters', () => {
  it('neutralizes a heading-shaped line inside AI prose without breaking document structure', () => {
    const { content } = generateDocument(
      input({
        review: combinedReview({
          ai: aiReview({ userApproach: '# Not a real heading\nSecond line.' }),
        }),
      }),
    );
    expect(content).toContain('\\# Not a real heading');
    // the document's real sections must still all be present and in order
    for (const h of REQUIRED_HEADINGS) {
      expect(content).toContain(h);
    }
  });

  it('escapes markdown-significant characters in the problem title', () => {
    const { content } = generateDocument(
      input({ problem: problem({ title: 'Weird *Title* with `code` and [brackets]' }) }),
    );
    expect(content).toContain('Weird \\*Title\\* with \\`code\\` and \\[brackets\\]');
  });

  it('does not let a list-item-shaped AI string inject a rogue bullet', () => {
    const { content } = generateDocument(
      input({
        review: combinedReview({
          ai: aiReview({ strengths: ['- fake bullet', 'normal strength'] }),
        }),
      }),
    );
    expect(content).toContain('\\- fake bullet');
  });

  it('escapes a raw HTML/script-shaped string embedded in AI prose', () => {
    const { content } = generateDocument(
      input({
        review: combinedReview({
          ai: aiReview({ whyItWorks: 'Safe because <script>alert(1)</script> never executes.' }),
        }),
      }),
    );
    expect(content).not.toContain('<script>');
    expect(content).toContain('\\<script\\>');
  });

  it('preserves special characters inside code blocks completely unescaped', () => {
    const code = 'var x = "*_[brackets]_* & <html> and `ticks`";';
    const { content } = generateDocument(input({ submission: submission({ code }) }));
    expect(content).toContain(code);
  });

  it('handles a problem description containing markdown-structural lines safely', () => {
    const description = '# Heading in description\n- a bullet\n1. an item\n```\nfake fence\n```';
    const { content } = generateDocument(input({ problem: problem({ description }) }));
    expect(content).not.toMatch(/\n```\nfake fence\n```\n/);
    expect(content).toContain('Original problem statement');
  });
});

describe('generateDocument — filename', () => {
  it('returns a zero-padded numbered filename derived from the slug', () => {
    const { filename } = generateDocument(input());
    expect(filename).toBe('001-two-sum.md');
  });

  it('omits the number when unknown', () => {
    const { filename } = generateDocument(input({ problem: problem({ number: null }) }));
    expect(filename).toBe('two-sum.md');
  });
});

describe('generateDocument — footer', () => {
  it('includes the submission id and generation timestamp', () => {
    const { content } = generateDocument(input());
    expect(content).toContain('sub-123');
    expect(content).toContain('2026-09-17T00:00:00.000Z');
  });
});

describe('generateDocument — throws for an impossible null-code submission', () => {
  it('throws rather than silently generating an empty solution section', () => {
    expect(() => generateDocument(input({ submission: submission({ code: null }) }))).toThrow();
  });
});

describe('generateDocument — improvement sections (Phase 9)', () => {
  const history = buildProblemHistory([
    attemptRecord({
      status: 'Wrong Answer',
      reviewed: true,
      aiTimeComplexity: 'O(n^2)',
      qualityScore: 50,
    }),
    attemptRecord({
      status: 'Accepted',
      reviewed: true,
      aiPatterns: ['Hash Map'],
      qualityScore: 90,
    }),
  ]);
  const mistakes = [
    {
      id: 'repeated-wrong-answer',
      kind: 'weakness' as const,
      title: 'Repeated Wrong Answer',
      description: 'Wrong Answer was the verdict on 2 of 5 attempts.',
      evidence: { count: 2, total: 5, examples: [] },
    },
  ];

  it('omits all three sections by default', () => {
    const { content } = generateDocument(input());
    expect(content).not.toContain('## Submission History');
    expect(content).not.toContain('## How My Solution Improved');
    expect(content).not.toContain('## Recurring Mistakes');
  });

  it('renders the history table and the improvement story before the footer', () => {
    const { content } = generateDocument(input({ history }));
    expect(content).toContain('## Submission History');
    expect(content).toContain('| Attempt | Date | Status |');
    expect(content).toContain('| 1 |');
    expect(content).toContain('Wrong Answer');
    expect(content).toContain('## How My Solution Improved');
    expect(content).toContain('Status path: Wrong Answer (attempt 1)');
    expect(content).toContain('**Attempt 1 → 2**');
    expect(content.indexOf('## How My Solution Improved')).toBeLessThan(
      content.indexOf('_Generated by CodeReviewAI'),
    );
  });

  it('shows "—" for values an unreviewed attempt does not have', () => {
    const partial = buildProblemHistory([
      attemptRecord({ status: 'Wrong Answer' }),
      attemptRecord({ status: 'Accepted', reviewed: true }),
    ]);
    const { content } = generateDocument(input({ history: partial }));
    expect(content).toMatch(/\| 1 \|[^\n]*Wrong Answer[^\n]*— \| — \| — \|/);
  });

  it('skips the history sections for a single attempt', () => {
    const single = buildProblemHistory([attemptRecord()]);
    expect(generateDocument(input({ history: single })).content).not.toContain(
      '## Submission History',
    );
  });

  it('renders recurring mistakes only when there are some', () => {
    expect(generateDocument(input({ recurringMistakes: [] })).content).not.toContain(
      '## Recurring Mistakes',
    );
    const { content } = generateDocument(input({ recurringMistakes: mistakes }));
    expect(content).toContain('## Recurring Mistakes');
    expect(content).toContain('**Repeated Wrong Answer**');
    expect(content).toContain('(2 of 5)');
  });

  it('escapes Markdown in generated statements and keeps the solution code untouched', () => {
    const hostile = [{ ...mistakes[0]!, title: '<script>alert(1)</script> | x' }];
    const { content } = generateDocument(input({ recurringMistakes: hostile }));
    expect(content).not.toContain('<script>alert(1)</script>');
    expect(content).toContain('var twoSum = function(nums, target) {\n  return [];\n};');
  });
});
