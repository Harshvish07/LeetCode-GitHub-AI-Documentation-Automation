import type { SolutionAnalysis } from '@codereviewai/analysis';
import type { LeetCodeProblemInfo, LeetCodeSubmissionInfo } from '@codereviewai/shared';
import { describe, expect, it } from 'vitest';
import type { CombinedSolutionReview } from '../ai/types.js';
import type { SolutionReview } from '../ai/schemas/solutionReview.schema.js';
import type { GeneratedDocument } from '../document/types.js';
import { GitHubError } from '../github/errors.js';
import {
  createFailingGitHubClient,
  createInMemoryGitHubClient,
} from '../github/mockGitHubClient.js';
import { GitHubPublishService, type PublishInput } from './github-publish.service.js';

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
    description: 'Return indices of the two numbers that add up to target.',
    ...overrides,
  };
}

function submission(overrides: Partial<LeetCodeSubmissionInfo> = {}): LeetCodeSubmissionInfo {
  return {
    language: 'JavaScript',
    code: 'var twoSum = function(nums, target) { return []; };',
    status: 'Accepted',
    runtime: '52 ms',
    memory: '42.1 MB',
    ...overrides,
  };
}

function deterministic(): SolutionAnalysis {
  return {
    detectedLanguage: 'JavaScript',
    detectedPatterns: [{ pattern: 'Hash Map', confidence: confidence(), evidence: [] }],
    estimatedTimeComplexity: { notation: 'O(n)', confidence: confidence(), reasoning: [] },
    estimatedSpaceComplexity: { notation: 'O(n)', confidence: confidence(), reasoning: [] },
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
  };
}

function aiReview(overrides: Partial<SolutionReview> = {}): SolutionReview {
  return {
    problemSummary: 'Find two numbers that sum to a target.',
    userApproach: 'Single-pass hash map lookup.',
    patterns: ['Hash Map'],
    whyItWorks: 'Each complement is checked in O(1).',
    complexity: { time: 'O(n)', space: 'O(n)' },
    strengths: ['Single pass'],
    improvements: [],
    correctnessConcerns: [],
    edgeCases: [],
    optimality: { isOptimal: true, reasoning: 'Linear time is optimal.' },
    betterApproach: null,
    alternativeApproaches: [],
    learningPoints: ['Hash maps trade space for time.'],
    relatedPatterns: ['Two Pointers'],
    confidence: 'high',
    ...overrides,
  };
}

function review(): CombinedSolutionReview {
  const det = deterministic();
  const ai = aiReview();
  return {
    submissionId: 'sub-1',
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
  };
}

function document(content = '# Two Sum\n\ncontent'): GeneratedDocument {
  return { filename: '001-two-sum.md', content };
}

function input(overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    problem: problem(),
    submission: submission(),
    review: review(),
    document: document(),
    ...overrides,
  };
}

const PROBLEM_PATH = 'problems/001-two-sum/README.md';

describe('GitHubPublishService.publish — create mode', () => {
  it('creates the problem file, the index, and the README on first publish', async () => {
    const client = createInMemoryGitHubClient();
    const service = new GitHubPublishService(client);

    const result = await service.publish(input({ mode: 'create' }));

    expect(result.status).toBe('created');
    expect(result.path).toBe(PROBLEM_PATH);
    expect(result.index.updated).toBe(true);
    expect(result.readme.updated).toBe(true);
    await expect(client.getFile(PROBLEM_PATH)).resolves.toMatchObject({
      content: document().content,
    });
  });

  it('returns a browsable link to the published document (used by the dashboard)', async () => {
    const client = createInMemoryGitHubClient({}, { defaultBranch: 'trunk' });
    const service = new GitHubPublishService(client);

    const result = await service.publish(input({ mode: 'create' }));

    expect(result.documentUrl).toBe(
      'https://github.com/mock/mock/blob/trunk/problems/001-two-sum/README.md',
    );
  });

  it('uses the exact task-example commit message style for a new problem', async () => {
    const client = createInMemoryGitHubClient();
    const service = new GitHubPublishService(client);

    await service.publish(input({ mode: 'create' }));

    const problemWrite = client.writeInputs.find((w) => w.path === PROBLEM_PATH);
    expect(problemWrite?.message).toBe('docs: add analysis for Two Sum');
  });

  it('writes problems/index.json containing the published problem', async () => {
    const client = createInMemoryGitHubClient();
    const service = new GitHubPublishService(client);

    await service.publish(input({ mode: 'create' }));

    const indexFile = await client.getFile('problems/index.json');
    expect(indexFile).not.toBeNull();
    const parsed = JSON.parse(indexFile!.content) as Array<{ slug: string; title: string }>;
    expect(parsed).toEqual([expect.objectContaining({ slug: 'two-sum', title: 'Two Sum' })]);
  });

  it('renders the root README table including the newly published problem', async () => {
    const client = createInMemoryGitHubClient();
    const service = new GitHubPublishService(client);

    await service.publish(input({ mode: 'create' }));

    const readme = await client.getFile('README.md');
    expect(readme?.content).toContain('Two Sum');
    expect(readme?.content).toContain(PROBLEM_PATH);
  });

  it('defaults to create mode when mode is omitted', async () => {
    const client = createInMemoryGitHubClient();
    const service = new GitHubPublishService(client);

    const result = await service.publish(input());

    expect(result.status).toBe('created');
  });

  it('rejects with CONFLICT when the problem already exists (duplicate detection — avoid accidental overwrite)', async () => {
    const client = createInMemoryGitHubClient({ [PROBLEM_PATH]: '# Two Sum\n\nold content' });
    const service = new GitHubPublishService(client);

    await expect(service.publish(input({ mode: 'create' }))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('does not write anything when create mode is rejected as a duplicate', async () => {
    const client = createInMemoryGitHubClient({ [PROBLEM_PATH]: '# Two Sum\n\nold content' });
    const service = new GitHubPublishService(client);

    await expect(service.publish(input({ mode: 'create' }))).rejects.toThrow();
    expect(client.writes).toHaveLength(0);
  });
});

describe('GitHubPublishService.publish — update mode (intentional re-analysis)', () => {
  it('updates an existing problem file when explicitly asked to', async () => {
    const client = createInMemoryGitHubClient({ [PROBLEM_PATH]: '# Two Sum\n\nold content' });
    const service = new GitHubPublishService(client);

    const result = await service.publish(
      input({ mode: 'update', document: document('# Two Sum\n\nnew content') }),
    );

    expect(result.status).toBe('updated');
    await expect(client.getFile(PROBLEM_PATH)).resolves.toMatchObject({
      content: '# Two Sum\n\nnew content',
    });
  });

  it('uses the exact task-style commit message for an update', async () => {
    const client = createInMemoryGitHubClient({ [PROBLEM_PATH]: '# Two Sum\n\nold content' });
    const service = new GitHubPublishService(client);

    await service.publish(
      input({ mode: 'update', document: document('# Two Sum\n\nnew content') }),
    );

    const problemWrite = client.writeInputs.find((w) => w.path === PROBLEM_PATH);
    expect(problemWrite?.message).toBe('docs: update analysis for Two Sum');
    expect(problemWrite?.sha).toBeTruthy();
  });

  it('rejects with NOT_FOUND when asked to update a problem that does not exist yet (defined re-analysis behavior)', async () => {
    const client = createInMemoryGitHubClient();
    const service = new GitHubPublishService(client);

    await expect(service.publish(input({ mode: 'update' }))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('is a no-op (status "unchanged") when the content is byte-identical, and creates no commits', async () => {
    const content = document().content;
    const client = createInMemoryGitHubClient({ [PROBLEM_PATH]: content });
    const service = new GitHubPublishService(client);

    const result = await service.publish(input({ mode: 'update', document: document(content) }));

    expect(result.status).toBe('unchanged');
    expect(client.writes).toHaveLength(0);
  });
});

describe('GitHubPublishService.publish — repository and API errors', () => {
  it('propagates a repository-lookup failure before touching any file (repository lookup)', async () => {
    const client = createFailingGitHubClient(new GitHubError('NOT_FOUND', 'no such repo'));
    const service = new GitHubPublishService(client);

    await expect(service.publish(input())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('propagates an authentication failure unchanged', async () => {
    const client = createFailingGitHubClient(new GitHubError('AUTH_FAILED', 'bad token'));
    const service = new GitHubPublishService(client);

    await expect(service.publish(input())).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('propagates a generic API error unchanged', async () => {
    const client = createFailingGitHubClient(new GitHubError('API_ERROR', 'upstream 500'));
    const service = new GitHubPublishService(client);

    await expect(service.publish(input())).rejects.toMatchObject({ code: 'API_ERROR' });
  });
});
