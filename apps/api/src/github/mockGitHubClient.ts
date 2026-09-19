import type { GitHubClient, GitHubFile, WriteFileInput, WriteFileResult } from './types.js';

/**
 * A test/dev-only `GitHubClient` implementation — never wired into the real
 * app (see `routes/index.ts`, which always constructs the real client via
 * `createGitHubClient()`). Exists so every other test in this repository can
 * exercise the publish pipeline without making a real GitHub API call, per
 * the task's "mock the GitHub API" requirement. Mirrors
 * `ai/providers/mockProvider.ts`'s shape.
 */
export interface InMemoryGitHubClient extends GitHubClient {
  /** Test-only inspection hook: every write, in call order, for asserting commit messages/content without re-reading through getFile(). */
  readonly writes: WriteFileResult[];
  readonly writeInputs: WriteFileInput[];
}

export function createInMemoryGitHubClient(
  initialFiles: Record<string, string> = {},
  options: { defaultBranch?: string } = {},
): InMemoryGitHubClient {
  const files = new Map<string, GitHubFile>(
    Object.entries(initialFiles).map(([path, content], index) => [
      path,
      { content, sha: `initial-sha-${index}` },
    ]),
  );
  const writes: WriteFileResult[] = [];
  const writeInputs: WriteFileInput[] = [];
  let nextShaCounter = 0;

  return {
    writes,
    writeInputs,
    async getRepository() {
      return {
        defaultBranch: options.defaultBranch ?? 'main',
        htmlUrl: 'https://github.com/mock/mock',
      };
    },
    async getFile(path: string): Promise<GitHubFile | null> {
      return files.get(path) ?? null;
    },
    async writeFile(input: WriteFileInput): Promise<WriteFileResult> {
      const sha = `sha-${++nextShaCounter}`;
      const commitSha = `commit-${nextShaCounter}`;
      files.set(input.path, { content: input.content, sha });
      const result: WriteFileResult = {
        sha,
        commitSha,
        commitUrl: `https://github.com/mock/mock/commit/${commitSha}`,
      };
      writeInputs.push(input);
      writes.push(result);
      return result;
    },
  };
}

/** Convenience for failure-path tests: every method rejects with the given error. */
export function createFailingGitHubClient(error: unknown): GitHubClient {
  return {
    getRepository: () => Promise.reject(error),
    getFile: () => Promise.reject(error),
    writeFile: () => Promise.reject(error),
  };
}
