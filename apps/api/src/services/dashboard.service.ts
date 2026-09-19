import {
  applyProblemQuery,
  type DashboardSummary,
  type PatternStat,
  type ProblemDetail,
  type ProblemListItem,
  type ProblemListQuery,
} from '@codereviewai/shared';
import { buildPatternStats, buildSummary, toProblemListItem } from '../analytics/statistics.js';
import type { LearningReader } from '../persistence/learningRepository.js';

/**
 * Turns the learning read-model into the numbers and lists the dashboard
 * shows. Deliberately thin: all the actual arithmetic lives in the pure,
 * database-free functions in `analytics/` (and search/filter/sort in
 * `@codereviewai/shared`), so this class only fetches, delegates, and
 * returns — `now` is injectable so streaks are deterministic in tests.
 */
export class DashboardService {
  constructor(
    private readonly reader: LearningReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [records, activityDates] = await Promise.all([
      this.reader.listProblemRecords(),
      this.reader.listActivityDates(),
    ]);
    return buildSummary(records, activityDates, this.now());
  }

  async getPatternStats(): Promise<PatternStat[]> {
    return buildPatternStats(await this.reader.listProblemRecords());
  }

  async listProblems(query: ProblemListQuery): Promise<ProblemListItem[]> {
    const records = await this.reader.listProblemRecords();
    return applyProblemQuery(records.map(toProblemListItem), query);
  }

  async getProblemDetail(submissionId: string): Promise<ProblemDetail | null> {
    return this.reader.getProblemDetail(submissionId);
  }
}
