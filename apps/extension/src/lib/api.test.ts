import type { LeetCodeExtraction } from '@codereviewai/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitSubmission, toCreateSubmissionRequest } from './api.js';

function sampleExtraction(): LeetCodeExtraction {
  return {
    problem: {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      description: 'Given an array of integers.',
    },
    submission: {
      language: 'JavaScript',
      code: 'return [];',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
    },
    extractedAt: '2026-01-01T00:00:00.000Z',
    warnings: [],
  };
}

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe('toCreateSubmissionRequest', () => {
  it('maps an extraction onto the wire contract, dropping warnings', () => {
    const extraction = sampleExtraction();

    const request = toCreateSubmissionRequest(extraction);

    expect(request).toEqual({
      problem: extraction.problem,
      submission: extraction.submission,
      metadata: { extractedAt: extraction.extractedAt, source: 'extension' },
    });
    expect(request).not.toHaveProperty('warnings');
  });
});

describe('submitSubmission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a success outcome for a 201 response', async () => {
    const stored = { id: 'abc-123', ...toCreateSubmissionRequest(sampleExtraction()) };
    mockFetchOnce(201, { success: true, data: stored });

    const outcome = await submitSubmission(toCreateSubmissionRequest(sampleExtraction()));

    expect(outcome).toEqual({ status: 'success', submission: stored });
  });

  it('returns a validation-error outcome with field-level issues for a 400 VALIDATION_ERROR response', async () => {
    mockFetchOnce(400, {
      success: false,
      error: {
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: [{ path: 'submission.code', message: 'submission.code is required' }],
      },
    });

    const outcome = await submitSubmission(toCreateSubmissionRequest(sampleExtraction()));

    expect(outcome).toEqual({
      status: 'validation-error',
      message: 'Request validation failed',
      issues: [{ path: 'submission.code', message: 'submission.code is required' }],
    });
  });

  it('returns a generic error outcome for a non-validation failure response', async () => {
    mockFetchOnce(500, {
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    });

    const outcome = await submitSubmission(toCreateSubmissionRequest(sampleExtraction()));

    expect(outcome).toEqual({ status: 'error', message: 'Internal server error' });
  });

  it('returns an error outcome when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const outcome = await submitSubmission(toCreateSubmissionRequest(sampleExtraction()));

    expect(outcome.status).toBe('error');
    if (outcome.status === 'error') {
      expect(outcome.message).toContain('localhost:4000');
    }
  });

  it('returns an error outcome when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 502,
        json: () => Promise.reject(new Error('not json')),
      }),
    );

    const outcome = await submitSubmission(toCreateSubmissionRequest(sampleExtraction()));

    expect(outcome.status).toBe('error');
    if (outcome.status === 'error') {
      expect(outcome.message).toContain('502');
    }
  });
});
