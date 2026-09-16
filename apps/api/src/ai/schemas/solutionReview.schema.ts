import { z } from 'zod';

/**
 * The strict contract every AI response must satisfy before it's trusted
 * anywhere in this system. This is deliberately independent of whatever
 * shape the prompt *asked* the model for — an LLM's raw output is untrusted
 * text until it passes this schema, exactly like Phase 3 treats a client's
 * request body as untrusted until Zod validates it. Each field maps to one
 * or more of the 16 questions the AI review must answer (see
 * docs/ai-analysis.md for the mapping).
 */

const complexitySchema = z.object({
  time: z.string().trim().min(1),
  space: z.string().trim().min(1),
});

const betterApproachSchema = z
  .object({
    description: z.string().trim().min(1),
    complexity: complexitySchema,
    whyBetter: z.string().trim().min(1),
  })
  .nullable();

const optimalitySchema = z.object({
  isOptimal: z.boolean(),
  reasoning: z.string().trim().min(1),
});

export const solutionReviewSchema = z.object({
  problemSummary: z.string().trim().min(1),
  userApproach: z.string().trim().min(1),
  patterns: z.array(z.string().trim().min(1)),
  whyItWorks: z.string().trim().min(1),
  complexity: complexitySchema,
  strengths: z.array(z.string().trim().min(1)),
  improvements: z.array(z.string().trim().min(1)),
  correctnessConcerns: z.array(z.string().trim().min(1)),
  edgeCases: z.array(z.string().trim().min(1)),
  optimality: optimalitySchema,
  betterApproach: betterApproachSchema,
  alternativeApproaches: z.array(z.string().trim().min(1)),
  learningPoints: z.array(z.string().trim().min(1)).min(1),
  relatedPatterns: z.array(z.string().trim().min(1)),
  confidence: z.enum(['low', 'medium', 'high']),
});

export type SolutionReview = z.infer<typeof solutionReviewSchema>;
