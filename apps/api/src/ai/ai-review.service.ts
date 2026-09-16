import { AiReviewError } from './errors.js';
import { buildReviewSystemPrompt, buildReviewUserPrompt } from './prompts/reviewPrompt.js';
import type { ReviewPromptInput } from './prompts/reviewPrompt.js';
import type { AiProvider, AiProviderRequest, AiProviderResponse } from './providers/types.js';
import { solutionReviewSchema } from './schemas/solutionReview.schema.js';
import type { SolutionReview } from './schemas/solutionReview.schema.js';

export interface AiReviewServiceConfig {
  maxOutputTokens: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: AiReviewServiceConfig = {
  maxOutputTokens: 4096,
  timeoutMs: 30_000,
};

/**
 * Orchestrates one AI review: builds the prompt, calls the injected
 * AiProvider (never a concrete provider class — see providers/types.ts),
 * and turns its raw text into a schema-validated SolutionReview or a typed
 * AiReviewError. Every error this class throws is an AiReviewError — a
 * misbehaving provider that throws something else gets wrapped, so callers
 * only ever need to handle one error type.
 */
export class AiReviewService {
  constructor(
    private readonly provider: AiProvider,
    private readonly config: AiReviewServiceConfig = DEFAULT_CONFIG,
  ) {}

  async generateReview(input: ReviewPromptInput): Promise<SolutionReview> {
    const request: AiProviderRequest = {
      systemPrompt: buildReviewSystemPrompt(),
      userPrompt: buildReviewUserPrompt(input),
      maxOutputTokens: this.config.maxOutputTokens,
      timeoutMs: this.config.timeoutMs,
    };

    const response = await this.callProviderWithTimeout(request);

    const json = tryParseJson(response.text);
    if (json === undefined) {
      throw new AiReviewError('MALFORMED_RESPONSE', 'AI response was not valid JSON.');
    }

    const parsed = solutionReviewSchema.safeParse(json);
    if (!parsed.success) {
      throw new AiReviewError(
        'SCHEMA_VALIDATION_FAILED',
        `AI response did not match the expected schema: ${summarizeZodIssues(parsed.error.issues)}`,
        parsed.error,
      );
    }

    return parsed.data;
  }

  /**
   * Defense-in-depth: even if `this.provider` doesn't honor `timeoutMs`
   * itself (e.g. a future provider implementation forgets to), this
   * guarantees generateReview() never hangs indefinitely. Also normalizes
   * anything the provider throws into an AiReviewError.
   */
  private async callProviderWithTimeout(request: AiProviderRequest): Promise<AiProviderResponse> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new AiReviewError(
            'TIMEOUT',
            `AI provider did not respond within ${request.timeoutMs}ms.`,
          ),
        );
      }, request.timeoutMs);
    });

    try {
      return await Promise.race([this.provider.generate(request), timeoutPromise]);
    } catch (error) {
      if (error instanceof AiReviewError) throw error;
      throw new AiReviewError('PROVIDER_ERROR', 'AI provider threw an unexpected error.', error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

/** Strips a ```json ... ``` (or bare ``` ... ```) fence if the whole response is wrapped in one — a common LLM habit even when explicitly told not to. */
function stripMarkdownFences(text: string): string {
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim());
  return fenceMatch ? fenceMatch[1]!.trim() : text;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(stripMarkdownFences(text.trim())) as unknown;
  } catch {
    return undefined;
  }
}

function summarizeZodIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): string {
  return issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}
