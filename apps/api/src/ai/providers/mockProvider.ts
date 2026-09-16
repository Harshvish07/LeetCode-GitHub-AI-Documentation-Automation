import type { AiProvider, AiProviderRequest, AiProviderResponse } from './types.js';

/**
 * A test/dev-only AiProvider implementation — never wired into the real app
 * (see routes/index.ts, which always constructs the real Anthropic
 * provider). Exists so every other test in this repository can exercise
 * ai-review.service.ts and the review endpoint without making a real,
 * billed network call, per the task's explicit "do not make real AI API
 * calls in unit tests" requirement.
 */
export function createMockProvider(
  handler: (request: AiProviderRequest) => AiProviderResponse | Promise<AiProviderResponse>,
): AiProvider {
  return { generate: (request) => Promise.resolve(handler(request)) };
}

/** Convenience for the common case: always return the same fixed text, ignoring the request. */
export function createFixedMockProvider(text: string): AiProvider {
  return createMockProvider(() => ({ text }));
}

/** Convenience for failure-path tests: always reject with the given error. */
export function createFailingMockProvider(error: unknown): AiProvider {
  return { generate: () => Promise.reject(error) };
}
