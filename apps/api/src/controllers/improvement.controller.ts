import {
  success,
  type ApiResponse,
  type AttemptComparison,
  type LearningProfile,
  type ProblemHistory,
  type Recommendations,
} from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import { parseCompareQuery } from '../schemas/compareQuery.schema.js';
import { AttemptNotFoundError, type ImprovementService } from '../services/improvement.service.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

function idParam(req: Request): string | undefined {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Thin HTTP handlers for the improvement engine's read endpoints; errors go to the central handler. */
export function createImprovementController(service: ImprovementService) {
  return {
    getHistory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = idParam(req);
        const history = id ? await service.getProblemHistory(id) : null;
        if (!history) {
          next(new NotFoundError(`No problem found for submission "${String(id)}".`));
          return;
        }
        const body: ApiResponse<ProblemHistory> = success(history);
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },

    compare: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = parseCompareQuery(req.query as Record<string, unknown>);
        if (!parsed.success) {
          next(new ValidationError(parsed.issues));
          return;
        }
        const id = idParam(req);
        const comparison = id ? await service.compare(id, parsed.from, parsed.to) : null;
        if (!comparison) {
          next(new NotFoundError(`No problem found for submission "${String(id)}".`));
          return;
        }
        const body: ApiResponse<AttemptComparison> = success(comparison);
        res.status(200).json(body);
      } catch (error) {
        next(error instanceof AttemptNotFoundError ? new NotFoundError(error.message) : error);
      }
    },

    getProfile: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body: ApiResponse<LearningProfile> = success(await service.getProfile());
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },

    getRecommendations: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body: ApiResponse<Recommendations> = success(await service.getRecommendations());
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },
  };
}
