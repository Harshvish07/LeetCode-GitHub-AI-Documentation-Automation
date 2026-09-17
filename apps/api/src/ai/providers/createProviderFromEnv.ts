import { createAnthropicProvider } from './anthropicProvider.js';
import { createGeminiProvider } from './geminiProvider.js';
import type { AiProvider } from './types.js';

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/**
 * Picks and configures the real AiProvider from environment variables —
 * the one place that knows AI_PROVIDER/AI_PROVIDER_API_KEY/AI_PROVIDER_MODEL
 * exist. Called only from routes/index.ts's composition root; every test
 * bypasses this entirely by injecting a mock provider via ApiRouterDeps.
 */
export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): AiProvider {
  const selected = (env.AI_PROVIDER ?? 'anthropic').trim().toLowerCase();

  switch (selected) {
    case 'gemini':
      return createGeminiProvider({
        apiKey: env.AI_PROVIDER_API_KEY,
        model: env.AI_PROVIDER_MODEL ?? DEFAULT_GEMINI_MODEL,
      });
    case 'anthropic':
      return createAnthropicProvider({
        apiKey: env.AI_PROVIDER_API_KEY,
        model: env.AI_PROVIDER_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
      });
    default:
      throw new Error(
        `Unknown AI_PROVIDER "${selected}". Supported values: "anthropic", "gemini".`,
      );
  }
}
