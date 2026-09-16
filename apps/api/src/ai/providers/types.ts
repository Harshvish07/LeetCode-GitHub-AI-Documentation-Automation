/**
 * The one interface ai-review.service.ts depends on — never a concrete
 * provider class directly — so the LLM vendor can be swapped (or a second
 * one added) without touching the service, the prompts, or the schema.
 * Mirrors how services/submissions.service.ts depends on
 * SubmissionRepository rather than InMemorySubmissionRepository (Phase 3).
 */
export interface AiProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Caps the provider's own response size; providers should pass this through to the vendor API where supported. */
  maxOutputTokens: number;
  /** Milliseconds before the provider must abort the request and fail with a timeout. */
  timeoutMs: number;
}

export interface AiProviderResponse {
  /** The raw text the model returned — not yet parsed or validated. */
  text: string;
}

export interface AiProvider {
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}
