import { afterEach, describe, expect, it, vi } from 'vitest';
import { fail, mockApi, ok, problemItem, summary } from '../testing/fixtures.js';
import { ApiRequestError, buildProblemQueryString, dashboardApi } from './dashboardApi.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildProblemQueryString', () => {
  it('is empty for an empty query', () => {
    expect(buildProblemQueryString({})).toBe('');
  });

  it('includes set values and skips undefined and blank ones', () => {
    const qs = buildProblemQueryString({
      search: ' two sum ',
      difficulty: 'Easy',
      pattern: undefined,
      status: '',
      sortBy: 'quality',
      sortOrder: 'desc',
    });
    const params = new URLSearchParams(qs);

    expect(qs.startsWith('?')).toBe(true);
    expect(params.get('search')).toBe('two sum');
    expect(params.get('difficulty')).toBe('Easy');
    expect(params.get('sortBy')).toBe('quality');
    expect(params.get('sortOrder')).toBe('desc');
    expect(params.has('pattern')).toBe(false);
    expect(params.has('status')).toBe(false);
  });

  it('URL-encodes special characters', () => {
    expect(buildProblemQueryString({ search: 'a&b=c' })).toBe('?search=a%26b%3Dc');
  });
});

describe('dashboardApi', () => {
  it('returns the data of a successful envelope', async () => {
    mockApi({ '/api/dashboard/summary': ok(summary()) });

    await expect(dashboardApi.getSummary()).resolves.toEqual(summary());
  });

  it('sends the query string for the problem list', async () => {
    const fetchMock = mockApi({ '/api/problems': ok([problemItem()]) });

    await dashboardApi.listProblems({ difficulty: 'Hard', sortBy: 'title' });

    expect(fetchMock).toHaveBeenCalledWith('/api/problems?difficulty=Hard&sortBy=title');
  });

  it('URL-encodes the submission id for the detail request', async () => {
    const fetchMock = mockApi({ '/api/problems/': ok({}) });

    await dashboardApi.getProblem('a/b');

    expect(fetchMock).toHaveBeenCalledWith('/api/problems/a%2Fb');
  });

  it('throws an ApiRequestError carrying the API error message and code', async () => {
    mockApi({
      '/api/dashboard/summary': fail('The dashboard needs a database', 'DATABASE_NOT_CONFIGURED'),
    });

    await expect(dashboardApi.getSummary()).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'The dashboard needs a database',
      code: 'DATABASE_NOT_CONFIGURED',
    });
  });

  it('throws NETWORK_ERROR when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(dashboardApi.getSummary()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('throws BAD_RESPONSE when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 502, json: () => Promise.reject(new Error('html')) }),
    );

    await expect(dashboardApi.getSummary()).rejects.toBeInstanceOf(ApiRequestError);
    await expect(dashboardApi.getSummary()).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      status: 502,
    });
  });

  it('throws BAD_RESPONSE when the JSON is not an API envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, json: async () => ({ hello: 'world' }) }),
    );

    await expect(dashboardApi.getSummary()).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});
