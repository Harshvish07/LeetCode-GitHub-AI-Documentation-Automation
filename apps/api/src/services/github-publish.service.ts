import type { LeetCodeProblemInfo, LeetCodeSubmissionInfo } from '@codereviewai/shared';
import type { CombinedSolutionReview } from '../ai/types.js';
import type { GeneratedDocument } from '../document/types.js';
import { CommitService } from '../github/commit.service.js';
import { GitHubError } from '../github/errors.js';
import { FileService } from '../github/file.service.js';
import {
  buildProblemRepoPath,
  PROBLEMS_INDEX_PATH,
  ROOT_README_PATH,
} from '../github/problemPath.js';
import { mergeProblemsTableIntoReadme, type ProblemIndexEntry } from '../github/readmeTable.js';
import { RepositoryService } from '../github/repository.service.js';
import type { GitHubClient } from '../github/types.js';

export type PublishMode = 'create' | 'update';

export interface PublishInput {
  problem: LeetCodeProblemInfo;
  submission: LeetCodeSubmissionInfo;
  review: CombinedSolutionReview;
  document: GeneratedDocument;
  /** Defaults to "create". See docs/github-integration.md#duplicate-handling for the full create/update contract. */
  mode?: PublishMode;
}

export interface PublishResult {
  status: 'created' | 'updated' | 'unchanged';
  path: string;
  /** A browsable link to the published document, e.g. https://github.com/owner/repo/blob/main/problems/001-two-sum/README.md */
  documentUrl: string;
  commitUrl?: string;
  index: { updated: boolean };
  readme: { updated: boolean };
}

/**
 * Orchestrates one publish: verifies the repository is reachable, detects
 * whether this problem already has a document (duplicate detection), enforces
 * the create-vs-update contract (never a silent accidental overwrite), writes
 * the problem's document, and keeps `problems/index.json` and the root
 * `README.md` table in sync — all via `github/*`'s small, single-purpose
 * services, never talking to `GitHubClient` directly itself. Mirrors
 * `services/combined-review.service.ts`'s role: the one place that spans two
 * lower layers (here, `github/` and Phase 6's `document/`) so a controller
 * never has to.
 */
export class GitHubPublishService {
  private readonly repository: RepositoryService;
  private readonly files: FileService;
  private readonly commits: CommitService;

  constructor(client: GitHubClient) {
    this.repository = new RepositoryService(client);
    this.files = new FileService(client);
    this.commits = new CommitService();
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const mode: PublishMode = input.mode ?? 'create';

    const repository = await this.repository.ensureAccessible();

    const path = buildProblemRepoPath({
      slug: input.problem.slug,
      number: input.problem.number,
      title: input.problem.title,
    });
    const existing = await this.files.findExisting(path);

    if (existing === null && mode === 'update') {
      throw new GitHubError(
        'NOT_FOUND',
        `Cannot update: no document exists yet at "${path}". Publish with mode="create" first.`,
      );
    }
    if (existing !== null && mode === 'create') {
      throw new GitHubError(
        'CONFLICT',
        `A document for this problem already exists at "${path}". Re-submit with mode="update" to intentionally overwrite it.`,
      );
    }

    const title = input.problem.title ?? input.problem.slug ?? 'this problem';
    const documentUrl = `${repository.htmlUrl}/blob/${repository.defaultBranch}/${path}`;

    if (existing !== null && existing.content === input.document.content) {
      return {
        status: 'unchanged',
        path,
        documentUrl,
        index: { updated: false },
        readme: { updated: false },
      };
    }

    const action = existing === null ? 'add-problem' : 'update-problem';
    const message = this.commits.buildMessage({ action, title });
    const result =
      existing === null
        ? await this.files.create(path, input.document.content, message)
        : await this.files.update(path, input.document.content, message, existing.sha);

    const { updated: indexUpdated, index } = await this.updateIndex(input, path, title);
    const readmeUpdated = await this.updateReadme(index);

    return {
      status: existing === null ? 'created' : 'updated',
      path,
      documentUrl,
      commitUrl: result.commitUrl,
      index: { updated: indexUpdated },
      readme: { updated: readmeUpdated },
    };
  }

  private async updateIndex(
    input: PublishInput,
    path: string,
    title: string,
  ): Promise<{ updated: boolean; index: ProblemIndexEntry[] }> {
    const existingFile = await this.files.findExisting(PROBLEMS_INDEX_PATH);
    const currentIndex = parseIndex(existingFile?.content);

    const entry: ProblemIndexEntry = {
      number: input.problem.number,
      slug: input.problem.slug ?? 'unknown',
      title,
      difficulty: input.problem.difficulty,
      pattern: input.review.ai.patterns.join(', '),
      complexity: input.review.ai.complexity.time,
      status: input.submission.status,
      path,
    };
    const updatedIndex = upsertEntry(currentIndex, entry);
    const newContent = `${JSON.stringify(updatedIndex, null, 2)}\n`;

    if (existingFile !== null && existingFile.content === newContent) {
      return { updated: false, index: updatedIndex };
    }

    const message = this.commits.buildMessage({ action: 'update-index', title });
    if (existingFile === null) {
      await this.files.create(PROBLEMS_INDEX_PATH, newContent, message);
    } else {
      await this.files.update(PROBLEMS_INDEX_PATH, newContent, message, existingFile.sha);
    }
    return { updated: true, index: updatedIndex };
  }

  private async updateReadme(index: ProblemIndexEntry[]): Promise<boolean> {
    const existingFile = await this.files.findExisting(ROOT_README_PATH);
    const newReadme = mergeProblemsTableIntoReadme(existingFile?.content ?? null, index);

    if (existingFile !== null && existingFile.content === newReadme) {
      return false;
    }

    const message = this.commits.buildMessage({ action: 'update-readme' });
    if (existingFile === null) {
      await this.files.create(ROOT_README_PATH, newReadme, message);
    } else {
      await this.files.update(ROOT_README_PATH, newReadme, message, existingFile.sha);
    }
    return true;
  }
}

function parseIndex(rawContent: string | undefined): ProblemIndexEntry[] {
  if (rawContent === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(rawContent);
    return Array.isArray(parsed) ? (parsed as ProblemIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function upsertEntry(index: ProblemIndexEntry[], entry: ProblemIndexEntry): ProblemIndexEntry[] {
  const existingPosition = index.findIndex((item) => item.slug === entry.slug);
  if (existingPosition === -1) return [...index, entry];
  const next = [...index];
  next[existingPosition] = entry;
  return next;
}
