import type { StoredSubmission } from '@codereviewai/shared';
import { describe, expect, it } from 'vitest';
import type { SubmissionRepository } from '../repositories/submissions.repository.js';
import { InMemorySubmissionRepository } from '../repositories/submissions.repository.js';
import type { ValidatedSubmissionInput } from '../schemas/submission.schema.js';
import { SubmissionService } from './submissions.service.js';

/** Records every submission handed to create(), so a test can assert on what the service actually persisted. */
class RecordingRepository implements SubmissionRepository {
  public readonly created: StoredSubmission[] = [];

  async create(submission: StoredSubmission): Promise<StoredSubmission> {
    this.created.push(submission);
    return submission;
  }

  async findById(id: string): Promise<StoredSubmission | null> {
    return this.created.find((submission) => submission.id === id) ?? null;
  }
}

function validInput(): ValidatedSubmissionInput {
  return {
    problem: {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: '  Two-Sum  ',
      number: 1,
      title: '  Two Sum  ',
      difficulty: 'Easy',
      description: '  Given an array of integers.  ',
    },
    submission: {
      language: 'JavaScript',
      code: 'var twoSum = function(nums, target) { return []; };',
      status: 'Accepted',
      runtime: '  52 ms  ',
      memory: '  42.1 MB  ',
    },
    metadata: {
      extractedAt: '2026-01-01T00:00:00.000Z',
      source: 'extension',
    },
  };
}

describe('SubmissionService', () => {
  it('normalizes whitespace and slug casing', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());

    const stored = await service.createSubmission(validInput());

    expect(stored.problem.slug).toBe('two-sum');
    expect(stored.problem.title).toBe('Two Sum');
    expect(stored.problem.description).toBe('Given an array of integers.');
    expect(stored.submission.runtime).toBe('52 ms');
    expect(stored.submission.memory).toBe('42.1 MB');
  });

  it('preserves submitted code exactly, without trimming or reformatting it', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());
    const input = validInput();
    input.submission.code = '  function f() {\n    return 1;\n  }\n';

    const stored = await service.createSubmission(input);

    expect(stored.submission.code).toBe('  function f() {\n    return 1;\n  }\n');
  });

  it('assigns a unique id to every submission', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());

    const first = await service.createSubmission(validInput());
    const second = await service.createSubmission(validInput());

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });

  it('records a server-side receivedAt independent of the client-claimed extractedAt', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());

    const stored = await service.createSubmission(validInput());

    expect(stored.metadata.extractedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(() => new Date(stored.metadata.receivedAt).toISOString()).not.toThrow();
    expect(stored.metadata.source).toBe('extension');
  });

  it('persists exactly the returned submission through the repository', async () => {
    const repository = new RecordingRepository();
    const service = new SubmissionService(repository);

    const stored = await service.createSubmission(validInput());

    expect(repository.created).toHaveLength(1);
    expect(repository.created[0]).toEqual(stored);
  });

  it('preserves nullable fields as null rather than inventing a value', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());
    const input = validInput();
    input.problem.number = null;
    input.problem.difficulty = null;
    input.problem.description = null;
    input.submission.language = null;
    input.submission.status = null;
    input.submission.runtime = null;
    input.submission.memory = null;

    const stored = await service.createSubmission(input);

    expect(stored.problem.number).toBeNull();
    expect(stored.problem.difficulty).toBeNull();
    expect(stored.problem.description).toBeNull();
    expect(stored.submission.language).toBeNull();
    expect(stored.submission.status).toBeNull();
    expect(stored.submission.runtime).toBeNull();
    expect(stored.submission.memory).toBeNull();
  });

  it('finds a previously created submission by id', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());
    const created = await service.createSubmission(validInput());

    const found = await service.getSubmissionById(created.id);

    expect(found).toEqual(created);
  });

  it('returns null for an unknown submission id', async () => {
    const service = new SubmissionService(new InMemorySubmissionRepository());

    const found = await service.getSubmissionById('does-not-exist');

    expect(found).toBeNull();
  });
});
