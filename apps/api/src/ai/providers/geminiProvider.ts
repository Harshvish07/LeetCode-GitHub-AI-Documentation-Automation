import { AiReviewError } from '../errors.js';
import type { AiProvider, AiProviderRequest, AiProviderResponse } from './types.js';

/**
 * A second concrete AiProvider implementation, calling Google's Gemini
 * `generateContent` API directly over `fetch` (no SDK, matching
 * anthropicProvider.ts's approach). Selected via AI_PROVIDER=gemini — see
 * providers/createProviderFromEnv.ts. Never called with a real network
 * request in this repository's own test suite — see
 * providers/geminiProvider.test.ts, which mocks `fetch` entirely.
 */
export interface GeminiProviderConfig {
  /** `undefined` (unset env var) is a valid, expected state in dev — generate() fails clearly instead of the whole process refusing to start. */
  apiKey: string | undefined;
  model: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
}

export function createGeminiProvider(config: GeminiProviderConfig): AiProvider {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  return {
    async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
      if (!config.apiKey) {
        throw new AiReviewError(
          'PROVIDER_ERROR',
          'AI provider is not configured: AI_PROVIDER_API_KEY is not set.',
        );
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), request.timeoutMs);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1beta/models/${config.model}:generateContent`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': config.apiKey,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: request.systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
            generationConfig: { maxOutputTokens: request.maxOutputTokens },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AiReviewError(
            'TIMEOUT',
            `AI provider request timed out after ${request.timeoutMs}ms.`,
            error,
          );
        }
        throw new AiReviewError('PROVIDER_ERROR', 'AI provider request failed.', error);
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (response.status === 429) {
        throw new AiReviewError('RATE_LIMITED', 'AI provider rate limit exceeded.');
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new AiReviewError(
          'PROVIDER_ERROR',
          `AI provider returned HTTP ${response.status}.${bodyText ? ` ${bodyText.slice(0, 500)}` : ''}`,
        );
      }

      let body: GeminiGenerateContentResponse;
      try {
        body = (await response.json()) as GeminiGenerateContentResponse;
      } catch (error) {
        throw new AiReviewError(
          'MALFORMED_RESPONSE',
          'AI provider response was not valid JSON.',
          error,
        );
      }

      const text = (body.candidates ?? [])
        .flatMap((candidate) => candidate.content?.parts ?? [])
        .filter((part): part is GeminiPart & { text: string } => typeof part.text === 'string')
        .map((part) => part.text)
        .join('');

      if (!text) {
        throw new AiReviewError(
          'MALFORMED_RESPONSE',
          'AI provider response contained no text content.',
        );
      }

      return { text };
    },
  };
}
