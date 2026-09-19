import {
  success,
  type ApiResponse,
  type DashboardSummary,
  type PatternStat,
  type ProblemDetail,
  type ProblemListItem,
} from '@codereviewai/shared';
import type { NextFunction, Request, Response } from 'express';
import { parseProblemQuery } from '../schemas/problemQuery.schema.js';
import type { DashboardService } from '../services/dashboard.service.js';
import { NotFoundError, ValidationError } from '../types/errors.js';

/**
 * Thin HTTP handlers for the dashboard's read endpoints — parse/validate the
 * request, call `DashboardService`, wrap the result in the shared
 * `ApiResponse` envelope. Any error (including the 503 from an unconfigured
 * database) goes to the centralized error handler via `next()`.
 */
export function createDashboardController(service: DashboardService) {
  return {
    getSummary: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body: ApiResponse<DashboardSummary> = success(await service.getSummary());
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },

    getPatterns: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body: ApiResponse<PatternStat[]> = success(await service.getPatternStats());
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },

    listProblems: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = parseProblemQuery(req.query as Record<string, unknown>);
        if (!parsed.success) {
          next(new ValidationError(parsed.issues));
          return;
        }
        const body: ApiResponse<ProblemListItem[]> = success(
          await service.listProblems(parsed.query),
        );
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },

    getProblem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        const detail = id ? await service.getProblemDetail(id) : null;
        if (!detail) {
          next(new NotFoundError(`No problem found for submission "${String(id)}".`));
          return;
        }
        const body: ApiResponse<ProblemDetail> = success(detail);
        res.status(200).json(body);
      } catch (error) {
        next(error);
      }
    },
  };
}
