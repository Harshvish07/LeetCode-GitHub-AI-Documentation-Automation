import { describe, expect, it } from 'vitest';
import { createProviderFromEnv } from './createProviderFromEnv.js';

describe('createProviderFromEnv', () => {
  it('defaults to the Anthropic provider when AI_PROVIDER is unset', () => {
    const provider = createProviderFromEnv({});

    expect(provider).toBeDefined();
    expect(typeof provider.generate).toBe('function');
  });

  it('selects the Gemini provider when AI_PROVIDER=gemini', () => {
    const provider = createProviderFromEnv({ AI_PROVIDER: 'gemini', AI_PROVIDER_API_KEY: 'k' });

    expect(provider).toBeDefined();
    expect(typeof provider.generate).toBe('function');
  });

  it('selects the Anthropic provider when AI_PROVIDER=anthropic', () => {
    const provider = createProviderFromEnv({
      AI_PROVIDER: 'anthropic',
      AI_PROVIDER_API_KEY: 'k',
    });

    expect(provider).toBeDefined();
    expect(typeof provider.generate).toBe('function');
  });

  it('is case-insensitive and trims whitespace', () => {
    const provider = createProviderFromEnv({ AI_PROVIDER: '  Gemini  ' });

    expect(provider).toBeDefined();
  });

  it('throws a clear error for an unknown provider name', () => {
    expect(() => createProviderFromEnv({ AI_PROVIDER: 'openai' })).toThrow(/Unknown AI_PROVIDER/);
  });
});
