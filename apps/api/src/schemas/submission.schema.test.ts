import { describe, expect, it } from 'vitest';
import { createSubmissionSchema } from './submission.schema.js';

function validPayload() {
  return {
    problem: {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      description: 'Given an array of integers, return indices of the two numbers.',
    },
    submission: {
      language: 'JavaScript',
      code: 'var twoSum = function(nums, target) { return []; };',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
    },
    metadata: {
      extractedAt: new Date().toISOString(),
      source: 'extension',
    },
  };
}

describe('createSubmissionSchema', () => {
  it('accepts a fully populated, valid submission', () => {
    const result = createSubmissionSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts nullable fields explicitly set to null (honest "unavailable" extraction)', () => {
    const payload = validPayload();
    payload.problem.number = null as unknown as number;
    payload.problem.difficulty = null as unknown as string;
    payload.problem.description = null as unknown as string;
    payload.submission.language = null as unknown as string;
    payload.submission.status = null as unknown as string;
    payload.submission.runtime = null as unknown as string;
    payload.submission.memory = null as unknown as string;

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects a missing submission.code (never invent it, never accept its absence)', () => {
    const payload = validPayload() as { submission: Record<string, unknown> };
    delete payload.submission.code;

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'submission.code')).toBe(
        true,
      );
    }
  });

  it('rejects an empty-string submission.code', () => {
    const payload = validPayload();
    payload.submission.code = '   ';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown submission.language', () => {
    const payload = validPayload();
    payload.submission.language = 'Fooscript';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === 'submission.language'),
      ).toBe(true);
    }
  });

  it('rejects a malformed problem.url', () => {
    const payload = validPayload();
    payload.problem.url = 'not-a-url';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a well-formed URL that is not a LeetCode problem URL', () => {
    const payload = validPayload();
    payload.problem.url = 'https://example.com/problems/two-sum/';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown submission.status', () => {
    const payload = validPayload();
    payload.submission.status = 'Definitely Accepted';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown problem.difficulty', () => {
    const payload = validPayload();
    payload.problem.difficulty = 'Impossible';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a missing problem.title', () => {
    const payload = validPayload() as { problem: Record<string, unknown> };
    delete payload.problem.title;

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid metadata.extractedAt', () => {
    const payload = validPayload();
    payload.metadata.extractedAt = '15 minutes ago';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a metadata.source other than "extension"', () => {
    const payload = validPayload();
    payload.metadata.source = 'web';

    const result = createSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a malformed payload (completely different shape)', () => {
    const result = createSubmissionSchema.safeParse(['not', 'an', 'object']);
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing entire top-level sections', () => {
    const result = createSubmissionSchema.safeParse({ problem: validPayload().problem });
    expect(result.success).toBe(false);
  });
});
