import { Octokit } from '@octokit/rest';
import { GitHubError } from './errors.js';
import type {
  GitHubAuthProvider,
  GitHubClient,
  GitHubFile,
  GitHubRepositoryInfo,
  WriteFileInput,
  WriteFileResult,
} from './types.js';

export interface GitHubClientConfig {
  owner: string;
  repo: string;
  authProvider: GitHubAuthProvider;
  /** Test/self-hosted-GitHub-Enterprise override — Octokit defaults to the real api.github.com. */
  baseUrl?: string;
  /** Test-only: Octokit natively supports injecting a fetch implementation (`new Octokit({ request: { fetch } })`), which `github-client.test.ts` uses instead of stubbing `globalThis.fetch` — never set in production. */
  fetch?: typeof globalThis.fetch;
}

/**
 * The one real `GitHubClient` implementation, and the only file in this
 * codebase that imports `@octokit/rest` — every other file depends only on
 * the `GitHubClient` interface (`types.ts`), the same dependency-inversion
 * shape as `ai/providers/anthropicProvider.ts`.
 *
 * Deliberately a **synchronous** factory, matching `createAnthropicProvider`/
 * `createGeminiProvider`: it never eagerly fetches a token or constructs
 * Octokit at composition-root time (`routes/index.ts`), so the whole API
 * still starts cleanly with no `GITHUB_TOKEN`/`GITHUB_REPO` configured —
 * only an actual publish attempt fails, clearly, the first time any method
 * below is called (`getOctokit()` resolves the token lazily, once, and
 * caches the resulting client).
 *
 * Never called with a real network request in this repository's own test
 * suite — see `github-client.test.ts`, which injects a mock `fetch`.
 */
export function createGitHubClient(config: GitHubClientConfig): GitHubClient {
  const { owner, repo } = config;
  let cachedOctokit: Octokit | undefined;

  async function getOctokit(): Promise<Octokit> {
    if (cachedOctokit) return cachedOctokit;
    const token = await config.authProvider.getToken();
    cachedOctokit = new Octokit({
      auth: token,
      baseUrl: config.baseUrl,
      request: config.fetch ? { fetch: config.fetch } : undefined,
    });
    return cachedOctokit;
  }

  return {
    async getRepository(): Promise<GitHubRepositoryInfo> {
      const octokit = await getOctokit();
      try {
        const response = await octokit.rest.repos.get({ owner, repo });
        return {
          defaultBranch: response.data.default_branch,
          htmlUrl: response.data.html_url,
        };
      } catch (error) {
        throw toGitHubError(error, `Failed to look up repository ${owner}/${repo}.`);
      }
    },

    async getFile(path: string): Promise<GitHubFile | null> {
      const octokit = await getOctokit();
      try {
        const response = await octokit.rest.repos.getContent({ owner, repo, path });
        const data = response.data;
        if (Array.isArray(data) || data.type !== 'file' || typeof data.content !== 'string') {
          throw new GitHubError('API_ERROR', `Path "${path}" is not a file.`);
        }
        return {
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
          sha: data.sha,
        };
      } catch (error) {
        if (isOctokitStatusError(error) && error.status === 404) {
          return null;
        }
        throw toGitHubError(error, `Failed to read "${path}".`);
      }
    },

    async writeFile(input: WriteFileInput): Promise<WriteFileResult> {
      const octokit = await getOctokit();
      try {
        const response = await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: input.path,
          message: input.message,
          content: Buffer.from(input.content, 'utf-8').toString('base64'),
          sha: input.sha,
        });
        const content = response.data.content;
        const commit = response.data.commit;
        if (!content?.sha || !commit?.sha) {
          throw new GitHubError(
            'API_ERROR',
            `GitHub returned an incomplete response writing "${input.path}".`,
          );
        }
        return {
          sha: content.sha,
          commitSha: commit.sha,
          commitUrl: commit.html_url ?? '',
        };
      } catch (error) {
        if (error instanceof GitHubError) throw error;
        throw toGitHubError(error, `Failed to write "${input.path}".`);
      }
    },
  };
}

interface OctokitStatusError {
  status: number;
  message?: string;
}

function isOctokitStatusError(error: unknown): error is OctokitStatusError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

function toGitHubError(error: unknown, contextMessage: string): GitHubError {
  if (error instanceof GitHubError) return error;

  if (!isOctokitStatusError(error)) {
    return new GitHubError('API_ERROR', contextMessage, error);
  }

  switch (error.status) {
    case 401:
      return new GitHubError(
        'AUTH_FAILED',
        `${contextMessage} Authentication failed — check GITHUB_TOKEN.`,
        error,
      );
    case 403:
      return new GitHubError(
        'RATE_LIMITED',
        `${contextMessage} GitHub returned 403 (rate limited or insufficient token permissions).`,
        error,
      );
    case 404:
      return new GitHubError(
        'NOT_FOUND',
        `${contextMessage} Not found — check GITHUB_REPO and token access.`,
        error,
      );
    case 409:
      return new GitHubError(
        'CONFLICT',
        `${contextMessage} GitHub reported a conflict (the file changed concurrently).`,
        error,
      );
    default:
      return new GitHubError(
        'API_ERROR',
        `${contextMessage} GitHub returned HTTP ${error.status}.`,
        error,
      );
  }
}
