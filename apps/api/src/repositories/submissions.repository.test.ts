import type { StoredSubmission } from '@codereviewai/shared';
import { describe, expect, it } from 'vitest';
import { InMemorySubmissionRepository } from './submissions.repository.js';

function stored(id: string): StoredSubmission {
  return {
    id,
    problem: {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      description: null,
    },
    submission: {
      language: 'JavaScript',
      code: 'return [];',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
    },
    metadata: {
      extractedAt: '2026-01-01T00:00:00.000Z',
      source: 'extension',
      receivedAt: '2026-01-01T00:00:01.000Z',
    },
  };
}

describe('InMemorySubmissionRepository', () => {
  it('returns exactly what was created', async () => {
    const repository = new InMemorySubmissionRepository();

    const created = await repository.create(stored('id-1'));

    expect(created).toEqual(stored('id-1'));
  });

  it('keeps submissions with different ids independent', async () => {
    const repository = new InMemorySubmissionRepository();

    await repository.create(stored('id-1'));
    const second = await repository.create(stored('id-2'));

    expect(second.id).toBe('id-2');
  });

  it('finds a previously created submission by id', async () => {
    const repository = new InMemorySubmissionRepository();
    await repository.create(stored('id-1'));

    const found = await repository.findById('id-1');

    expect(found).toEqual(stored('id-1'));
  });

  it('returns null for an unknown id rather than throwing', async () => {
    const repository = new InMemorySubmissionRepository();

    const found = await repository.findById('does-not-exist');

    expect(found).toBeNull();
  });
});
