import type {
  AnalysisDetail,
  LeetCodeDifficulty,
  ProblemDetail,
  ReviewDetail,
} from '@codereviewai/shared';
import type { SolutionAnalysis } from '@codereviewai/analysis';
import { randomUUID } from 'node:crypto';
import type { CombinedSolutionReview } from '../ai/types.js';
import { computeQualityScore } from '../analytics/qualityScore.js';
import type { AttemptRecord } from '../analytics/attempts.js';
import type { ProblemRecord } from '../analytics/statistics.js';
import type { GeneratedDocument } from '../document/types.js';
import type { Database } from './database.js';
import type { LearningReader, LearningRecorder, PublicationInfo } from './learningRepository.js';
import { DEFAULT_USER_ID } from './migrations/001_initial_schema.js';
import { UUID_PATTERN } from './postgresSubmissionRepository.js';
import { parseJson, stringArray, toIso, toIsoOrNull } from './rowMapping.js';

interface RecordRow {
  submission_id: string;
  problem_id: string;
  number: number | null;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  language: string | null;
  status: string | null;
  received_at: unknown;
  static_patterns: unknown;
  static_time: string | null;
  ai_patterns: unknown;
  ai_time: string | null;
  quality_score: number | null;
  is_optimal: boolean | null;
  correctness_concerns_count: number | null;
  reviewed: boolean;
  github_url: string | null;
}

interface AttemptRow {
  submission_id: string;
  problem_id: string;
  number: number | null;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  language: string | null;
  code: string;
  status: string | null;
  runtime: string | null;
  memory: string | null;
  received_at: unknown;
  static_patterns: unknown;
  static_time: string | null;
  static_space: string | null;
  ai_patterns: unknown;
  ai_time: string | null;
  ai_space: string | null;
  quality_score: number | null;
  is_optimal: boolean | null;
  correctness_concerns_count: number | null;
  improvements_count: number | null;
  review: unknown;
  reviewed: boolean;
}

/** The fields of the stored AI review JSON the improvement engine reads. */
interface StoredReviewFields {
  userApproach?: unknown;
  correctnessConcerns?: unknown;
  betterApproach?: { description?: unknown; complexity?: { time?: unknown } } | null;
}

const ATTEMPT_SELECT = `SELECT s.id AS submission_id, p.id AS problem_id, p.number, p.slug, p.title, p.difficulty,
              s.language, s.code, s.status, s.runtime, s.memory, s.received_at,
              a.patterns AS static_patterns, a.time_complexity AS static_time,
              a.space_complexity AS static_space,
              r.patterns AS ai_patterns, r.time_complexity AS ai_time,
              r.space_complexity AS ai_space, r.quality_score, r.is_optimal,
              r.correctness_concerns_count, r.improvements_count, r.result AS review,
              (r.id IS NOT NULL) AS reviewed
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         LEFT JOIN analyses a ON a.submission_id = s.id
         LEFT JOIN reviews r ON r.submission_id = s.id`;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

function toAttemptRecord(row: AttemptRow): AttemptRecord {
  const review = row.review ? parseJson<StoredReviewFields>(row.review) : null;
  return {
    submissionId: row.submission_id,
    problemId: row.problem_id,
    number: row.number,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    language: row.language,
    code: row.code,
    status: row.status,
    runtime: row.runtime,
    memory: row.memory,
    submittedAt: toIso(row.received_at),
    reviewed: row.reviewed,
    staticPatterns: stringArray(row.static_patterns),
    aiPatterns: stringArray(row.ai_patterns),
    staticTimeComplexity: row.static_time,
    aiTimeComplexity: row.ai_time,
    staticSpaceComplexity: row.static_space,
    aiSpaceComplexity: row.ai_space,
    qualityScore: row.quality_score,
    isOptimal: row.is_optimal,
    correctnessConcernsCount: row.correctness_concerns_count,
    improvementsCount: row.improvements_count,
    correctnessConcerns: stringArray(review?.correctnessConcerns ?? []),
    approach: asString(review?.userApproach),
    betterApproachDescription: asString(review?.betterApproach?.description),
    betterApproachTimeComplexity: asString(review?.betterApproach?.complexity?.time),
  };
}

interface DetailRow {
  submission_id: string;
  language: string | null;
  code: string;
  status: string | null;
  runtime: string | null;
  memory: string | null;
  received_at: unknown;
  number: number | null;
  slug: string;
  title: string;
  difficulty: LeetCodeDifficulty | null;
  url: string;
  description: string | null;
  analysis: unknown;
  review: unknown;
  agreement: unknown;
  quality_score: number | null;
  filename: string | null;
  github_url: string | null;
  published_at: unknown;
}

/**
 * The Postgres implementation of both halves of the learning read-model
 * (`LearningRecorder` writes, `LearningReader` reads) for one user. Full
 * analysis/review JSON is stored as `jsonb` (so the dashboard's detail view
 * never loses anything the AI said), while the fields the dashboard
 * *queries and aggregates* (patterns, complexity, quality, optimality) are
 * also copied into real columns — see docs/database.md for why.
 */
export class PostgresLearningRepository implements LearningRecorder, LearningReader {
  constructor(
    private readonly db: Database,
    private readonly userId: string = DEFAULT_USER_ID,
  ) {}

  async recordReview(combined: CombinedSolutionReview): Promise<void> {
    const { deterministic, ai, agreement } = combined;

    await this.db.transaction(async (tx) => {
      const [analysis] = await tx.query<{ id: string }>(
        `INSERT INTO analyses
           (id, submission_id, result, patterns, time_complexity, space_complexity, confidence)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
         ON CONFLICT (submission_id) DO UPDATE SET
           result = EXCLUDED.result,
           patterns = EXCLUDED.patterns,
           time_complexity = EXCLUDED.time_complexity,
           space_complexity = EXCLUDED.space_complexity,
           confidence = EXCLUDED.confidence,
           created_at = now()
         RETURNING id`,
        [
          randomUUID(),
          combined.submissionId,
          JSON.stringify(deterministic),
          JSON.stringify(deterministic.detectedPatterns.map((match) => match.pattern)),
          deterministic.estimatedTimeComplexity.notation,
          deterministic.estimatedSpaceComplexity.notation,
          deterministic.confidence.level,
        ],
      );

      const qualityScore = computeQualityScore({
        isOptimal: ai.optimality.isOptimal,
        correctnessConcernsCount: ai.correctnessConcerns.length,
        improvementsCount: ai.improvements.length,
        hasDisagreement: agreement.hasDisagreement,
        confidence: ai.confidence,
      });

      await tx.query(
        `INSERT INTO reviews
           (id, submission_id, analysis_id, result, agreement, patterns, time_complexity,
            space_complexity, is_optimal, correctness_concerns_count, improvements_count,
            has_disagreement, confidence, quality_score)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (submission_id) DO UPDATE SET
           analysis_id = EXCLUDED.analysis_id,
           result = EXCLUDED.result,
           agreement = EXCLUDED.agreement,
           patterns = EXCLUDED.patterns,
           time_complexity = EXCLUDED.time_complexity,
           space_complexity = EXCLUDED.space_complexity,
           is_optimal = EXCLUDED.is_optimal,
           correctness_concerns_count = EXCLUDED.correctness_concerns_count,
           improvements_count = EXCLUDED.improvements_count,
           has_disagreement = EXCLUDED.has_disagreement,
           confidence = EXCLUDED.confidence,
           quality_score = EXCLUDED.quality_score,
           created_at = now()`,
        [
          randomUUID(),
          combined.submissionId,
          analysis!.id,
          JSON.stringify(ai),
          JSON.stringify(agreement),
          JSON.stringify(ai.patterns),
          ai.complexity.time,
          ai.complexity.space,
          ai.optimality.isOptimal,
          ai.correctnessConcerns.length,
          ai.improvements.length,
          agreement.hasDisagreement,
          ai.confidence,
          qualityScore,
        ],
      );
    });
  }

  async recordDocument(submissionId: string, document: GeneratedDocument): Promise<void> {
    await this.db.query(
      `INSERT INTO documents (id, submission_id, review_id, filename, content)
       VALUES ($1, $2, (SELECT id FROM reviews WHERE submission_id = $2), $3, $4)
       ON CONFLICT (submission_id) DO UPDATE SET
         review_id = EXCLUDED.review_id,
         filename = EXCLUDED.filename,
         content = EXCLUDED.content,
         updated_at = now()`,
      [randomUUID(), submissionId, document.filename, document.content],
    );
  }

  async recordPublication(submissionId: string, publication: PublicationInfo): Promise<void> {
    await this.db.query(
      `UPDATE documents
          SET github_path = $2, github_url = $3, commit_url = $4, published_at = $5, updated_at = now()
        WHERE submission_id = $1`,
      [
        submissionId,
        publication.path,
        publication.documentUrl,
        publication.commitUrl ?? null,
        publication.publishedAt,
      ],
    );
  }

  async listProblemRecords(): Promise<ProblemRecord[]> {
    const rows = await this.db.query<RecordRow>(
      `SELECT DISTINCT ON (s.problem_id)
              s.id AS submission_id, p.id AS problem_id, p.number, p.slug, p.title, p.difficulty,
              s.language, s.status, s.received_at,
              a.patterns AS static_patterns, a.time_complexity AS static_time,
              r.patterns AS ai_patterns, r.time_complexity AS ai_time, r.quality_score,
              r.is_optimal, r.correctness_concerns_count,
              (r.id IS NOT NULL) AS reviewed, d.github_url
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         LEFT JOIN analyses a ON a.submission_id = s.id
         LEFT JOIN reviews r ON r.submission_id = s.id
         LEFT JOIN documents d ON d.submission_id = s.id
        WHERE s.user_id = $1
        ORDER BY s.problem_id, s.received_at DESC`,
      [this.userId],
    );

    return rows.map((row) => ({
      submissionId: row.submission_id,
      problemId: row.problem_id,
      number: row.number,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      language: row.language,
      status: row.status,
      submittedAt: toIso(row.received_at),
      staticPatterns: stringArray(row.static_patterns),
      aiPatterns: stringArray(row.ai_patterns),
      staticTimeComplexity: row.static_time,
      aiTimeComplexity: row.ai_time,
      qualityScore: row.quality_score,
      isOptimal: row.is_optimal,
      correctnessConcernsCount: row.correctness_concerns_count,
      reviewed: row.reviewed,
      githubUrl: row.github_url,
    }));
  }

  async listAttemptRecords(): Promise<AttemptRecord[]> {
    const rows = await this.db.query<AttemptRow>(
      `${ATTEMPT_SELECT}
        WHERE s.user_id = $1
        ORDER BY s.received_at ASC, s.id ASC`,
      [this.userId],
    );
    return rows.map(toAttemptRecord);
  }

  async getProblemAttempts(submissionId: string): Promise<AttemptRecord[] | null> {
    if (!UUID_PATTERN.test(submissionId)) return null;
    const rows = await this.db.query<AttemptRow>(
      `${ATTEMPT_SELECT}
        WHERE s.user_id = $1
          AND s.problem_id = (SELECT problem_id FROM submissions WHERE id = $2 AND user_id = $1)
        ORDER BY s.received_at ASC, s.id ASC`,
      [this.userId, submissionId],
    );
    return rows.length === 0 ? null : rows.map(toAttemptRecord);
  }

  async listActivityDates(): Promise<string[]> {
    const rows = await this.db.query<{ received_at: unknown }>(
      'SELECT received_at FROM submissions WHERE user_id = $1',
      [this.userId],
    );
    return rows.map((row) => toIso(row.received_at));
  }

  async getProblemDetail(submissionId: string): Promise<ProblemDetail | null> {
    if (!UUID_PATTERN.test(submissionId)) return null;

    const rows = await this.db.query<DetailRow>(
      `SELECT s.id AS submission_id, s.language, s.code, s.status, s.runtime, s.memory, s.received_at,
              p.number, p.slug, p.title, p.difficulty, p.url, p.description,
              a.result AS analysis, r.result AS review, r.agreement, r.quality_score,
              d.filename, d.github_url, d.published_at
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         LEFT JOIN analyses a ON a.submission_id = s.id
         LEFT JOIN reviews r ON r.submission_id = s.id
         LEFT JOIN documents d ON d.submission_id = s.id
        WHERE s.id = $1 AND s.user_id = $2`,
      [submissionId, this.userId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      submissionId: row.submission_id,
      problem: {
        number: row.number,
        slug: row.slug,
        title: row.title,
        difficulty: row.difficulty,
        url: row.url,
        description: row.description,
      },
      submission: {
        language: row.language,
        code: row.code,
        status: row.status,
        runtime: row.runtime,
        memory: row.memory,
        submittedAt: toIso(row.received_at),
      },
      analysis: row.analysis ? toAnalysisDetail(parseJson<SolutionAnalysis>(row.analysis)) : null,
      review: row.review
        ? toReviewDetail(parseJson<Omit<ReviewDetail, 'agreement'>>(row.review), row.agreement)
        : null,
      qualityScore: row.quality_score,
      document: row.filename
        ? {
            filename: row.filename,
            githubUrl: row.github_url,
            publishedAt: toIsoOrNull(row.published_at),
          }
        : null,
    };
  }
}

function toAnalysisDetail(analysis: SolutionAnalysis): AnalysisDetail {
  return {
    patterns: analysis.detectedPatterns.map((match) => ({
      pattern: match.pattern,
      confidence: match.confidence.level,
    })),
    timeComplexity: {
      notation: analysis.estimatedTimeComplexity.notation,
      confidence: analysis.estimatedTimeComplexity.confidence.level,
    },
    spaceComplexity: {
      notation: analysis.estimatedSpaceComplexity.notation,
      confidence: analysis.estimatedSpaceComplexity.confidence.level,
    },
    confidence: analysis.confidence.level,
    possibleIssues: analysis.possibleIssues.map(({ message, severity }) => ({ message, severity })),
    codeQualityObservations: analysis.codeQualityObservations.map(({ message, severity }) => ({
      message,
      severity,
    })),
    edgeCaseObservations: analysis.edgeCaseObservations.map(({ concern, detail, severity }) => ({
      concern,
      detail,
      severity,
    })),
  };
}

function toReviewDetail(review: Omit<ReviewDetail, 'agreement'>, agreement: unknown): ReviewDetail {
  return { ...review, agreement: parseJson<ReviewDetail['agreement']>(agreement) };
}
