import type { ApiResponse, HealthStatus } from '@codereviewai/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('GET /api/health', () => {
  const app = createApp({ corsOrigin: 'http://localhost:5173' });

  it('returns a 200 with an ok status payload', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);

    const body = response.body as ApiResponse<HealthStatus>;
    expect(body.success).toBe(true);
    if (body.success) {
      expect(body.data.status).toBe('ok');
      expect(typeof body.data.uptimeSeconds).toBe('number');
      expect(typeof body.data.timestamp).toBe('string');
    }
  });
});
