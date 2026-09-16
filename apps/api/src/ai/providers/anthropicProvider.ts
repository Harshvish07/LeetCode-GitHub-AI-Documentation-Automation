import { AiReviewError } from '../errors.js';
import type { AiProvider, AiProviderRequest, AiProviderResponse } from './types.js';

/**
 * The one concrete AiProvider implementation today, calling Anthropic's
 * Messages API directly over `fetch` (no SDK dependency — one HTTP call
 * doesn't need one). A different vendor would be a new file implementing
 * the same `AiProvider` interface; nothing else in `ai/` would need to
 * change. Never called with a real network request in this repository's
 * own test suite — see providers/anthropicProvider.test.ts, which mocks
 * `fetch` entirely.
 */
export interface AnthropicProviderConfig {
  /** `undefined` (unset env var) is a valid, expected state in dev — generate() fails clearly instead of the whole process refusing to start. */
  apiKey: string | undefined;
  model: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
}

export function createAnthropicProvider(config: AnthropicProviderConfig): AiProvider {
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
        response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: request.maxOutputTokens,
            system: request.systemPrompt,
            messages: [{ role: 'user', content: request.userPrompt }],
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

      let body: AnthropicMessagesResponse;
      try {
        body = (await response.json()) as AnthropicMessagesResponse;
      } catch (error) {
        throw new AiReviewError(
          'MALFORMED_RESPONSE',
          'AI provider response was not valid JSON.',
          error,
        );
      }

      const text = (body.content ?? [])
        .filter(
          (block): block is AnthropicContentBlock & { text: string } =>
            block.type === 'text' && typeof block.text === 'string',
        )
        .map((block) => block.text)
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
