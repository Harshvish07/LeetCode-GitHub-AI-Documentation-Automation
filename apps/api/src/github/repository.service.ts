import type { GitHubClient, GitHubRepositoryInfo } from './types.js';

/**
 * Repository-level GitHub operations — today just the pre-flight
 * "repository lookup" the task calls out as its own testable behavior:
 * confirming the configured `GITHUB_REPO` actually exists and the token can
 * see it, before any file operations are attempted. A `GitHubError` from
 * `client.getRepository()` (404 not found, 401 auth failed) propagates
 * unchanged — this service adds no new error handling, only a clear name
 * for the operation.
 */
export class RepositoryService {
  constructor(private readonly client: GitHubClient) {}

  async ensureAccessible(): Promise<GitHubRepositoryInfo> {
    return this.client.getRepository();
  }
}
