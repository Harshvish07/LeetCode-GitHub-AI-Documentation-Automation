import type { ApiResponse, StoredSubmission } from '@codereviewai/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

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

function buildApp() {
  return createApp({ corsOrigin: 'http://localhost:5173' });
}

describe('POST /api/submissions', () => {
  it('accepts a valid submission and returns 201 with the normalized, stored submission', async () => {
    const response = await request(buildApp()).post('/api/submissions').send(validPayload());

    expect(response.status).toBe(201);

    const body = response.body as ApiResponse<StoredSubmission>;
    expect(body.success).toBe(true);
    if (body.success) {
      expect(body.data.id).toBeTruthy();
      expect(body.data.problem.slug).toBe('two-sum');
      expect(body.data.problem.title).toBe('Two Sum');
      expect(body.data.submission.status).toBe('Accepted');
      expect(body.data.metadata.source).toBe('extension');
      expect(body.data.metadata.receivedAt).toBeTruthy();
    }
  });

  it('assigns a different id to each of two submissions', async () => {
    const app = buildApp();

    const first = await request(app).post('/api/submissions').send(validPayload());
    const second = await request(app).post('/api/submissions').send(validPayload());

    const firstBody = first.body as ApiResponse<StoredSubmission>;
    const secondBody = second.body as ApiResponse<StoredSubmission>;
    if (firstBody.success && secondBody.success) {
      expect(firstBody.data.id).not.toBe(secondBody.data.id);
    } else {
      throw new Error('expected both submissions to succeed');
    }
  });

  it('rejects an invalid submission with 400 and per-field validation details', async () => {
    const payload = validPayload();
    payload.problem.title = '';

    const response = await request(buildApp()).post('/api/submissions').send(payload);

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    expect(body.success).toBe(false);
    if (!body.success) {
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.error.details)).toBe(true);
    }
  });

  it('rejects a submission missing code with 400', async () => {
    const payload = validPayload() as { submission: Record<string, unknown> };
    delete payload.submission.code;

    const response = await request(buildApp()).post('/api/submissions').send(payload);

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    if (!body.success) {
      const details = body.error.details as Array<{ path: string }>;
      expect(details.some((detail) => detail.path === 'submission.code')).toBe(true);
    }
  });

  it('rejects a submission with an invalid language with 400', async () => {
    const payload = validPayload();
    payload.submission.language = 'Fooscript';

    const response = await request(buildApp()).post('/api/submissions').send(payload);

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    expect(body.success).toBe(false);
  });

  it('rejects a submission with an invalid problem URL with 400', async () => {
    const payload = validPayload();
    payload.problem.url = 'https://example.com/not-leetcode';

    const response = await request(buildApp()).post('/api/submissions').send(payload);

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    expect(body.success).toBe(false);
  });

  it('rejects a malformed (wrong-shape) payload with 400', async () => {
    const response = await request(buildApp()).post('/api/submissions').send({ nonsense: true });

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    expect(body.success).toBe(false);
  });

  it('rejects syntactically invalid JSON with 400, not a raw 500', async () => {
    const response = await request(buildApp())
      .post('/api/submissions')
      .set('Content-Type', 'application/json')
      .send('{ not valid json');

    expect(response.status).toBe(400);
    const body = response.body as ApiResponse<never>;
    expect(body.success).toBe(false);
    if (!body.success) {
      expect(body.error.code).toBe('MALFORMED_JSON');
    }
  });

  it('returns a consistent 404 envelope for an unknown route', async () => {
    const response = await request(buildApp()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    const body = response.body as ApiResponse<never>;
    expect(body.success).toBe(false);
    if (!body.success) {
      expect(body.error.code).toBe('NOT_FOUND');
    }
  });
});
