import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiReviewError } from '../errors.js';
import { createGeminiProvider } from './geminiProvider.js';

function baseRequest() {
  return { systemPrompt: 'system', userPrompt: 'user', maxOutputTokens: 1000, timeoutMs: 5000 };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('createGeminiProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails clearly, without calling fetch, when no API key is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createGeminiProvider({ apiKey: undefined, model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the concatenated text content on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          candidates: [{ content: { parts: [{ text: '{"a":' }, { text: '1}' }] } }],
        }),
      ),
    );
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    const result = await provider.generate(baseRequest());

    expect(result.text).toBe('{"a":1}');
  });

  it('sends the expected request shape to the Gemini generateContent API', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await provider.generate({
      systemPrompt: 'SYS',
      userPrompt: 'USER',
      maxOutputTokens: 2048,
      timeoutMs: 5000,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.system_instruction).toEqual({ parts: [{ text: 'SYS' }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'USER' }] }]);
    expect(body.generationConfig).toEqual({ maxOutputTokens: 2048 });
  });

  it('never puts the API key in the URL', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      );
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createGeminiProvider({
      apiKey: 'super-secret-key',
      model: 'gemini-2.5-flash',
    });

    await provider.generate(baseRequest());

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('super-secret-key');
  });

  it('raises RATE_LIMITED on an HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { error: 'rate limited' })));
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('raises PROVIDER_ERROR on a non-2xx, non-429 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: 'internal' })));
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('raises PROVIDER_ERROR when fetch itself rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('raises TIMEOUT when the request is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      }),
    );
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate({ ...baseRequest(), timeoutMs: 20 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('raises MALFORMED_RESPONSE when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('not json'),
      } as unknown as Response),
    );
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'MALFORMED_RESPONSE',
    });
  });

  it('raises MALFORMED_RESPONSE when the response has no candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { candidates: [] })));
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'MALFORMED_RESPONSE',
    });
  });

  it('every rejected error is an AiReviewError instance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, {})));
    const provider = createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash' });

    await expect(provider.generate(baseRequest())).rejects.toBeInstanceOf(AiReviewError);
  });
});
