import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiReviewError } from '../errors.js';
import { createAnthropicProvider } from './anthropicProvider.js';

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

describe('createAnthropicProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails clearly, without calling fetch, when no API key is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createAnthropicProvider({ apiKey: undefined, model: 'claude-sonnet-5' });

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
          content: [
            { type: 'text', text: '{"a":' },
            { type: 'text', text: '1}' },
          ],
        }),
      ),
    );
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    const result = await provider.generate(baseRequest());

    expect(result.text).toBe('{"a":1}');
  });

  it('sends the expected request shape to the Anthropic Messages API', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { content: [{ type: 'text', text: 'ok' }] }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    await provider.generate({
      systemPrompt: 'SYS',
      userPrompt: 'USER',
      maxOutputTokens: 2048,
      timeoutMs: 5000,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('test-key');
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.model).toBe('claude-sonnet-5');
    expect(body.max_tokens).toBe(2048);
    expect(body.system).toBe('SYS');
    expect(body.messages).toEqual([{ role: 'user', content: 'USER' }]);
  });

  it('raises RATE_LIMITED on an HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { error: 'rate limited' })));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('raises PROVIDER_ERROR on a non-2xx, non-429 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: 'internal' })));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('raises PROVIDER_ERROR when fetch itself rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

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
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

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
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'MALFORMED_RESPONSE',
    });
  });

  it('raises MALFORMED_RESPONSE when the response has no text content blocks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { content: [] })));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    await expect(provider.generate(baseRequest())).rejects.toMatchObject({
      code: 'MALFORMED_RESPONSE',
    });
  });

  it('every rejected error is an AiReviewError instance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, {})));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'claude-sonnet-5' });

    await expect(provider.generate(baseRequest())).rejects.toBeInstanceOf(AiReviewError);
  });
});
