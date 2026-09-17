import { createEnvTokenAuthProvider } from './auth.js';
import { GitHubError } from './errors.js';
import { createGitHubClient } from './github-client.js';
import type { GitHubClient } from './types.js';

/**
 * Builds the real `GitHubClient` from environment variables — the single
 * place that knows `GITHUB_TOKEN`/`GITHUB_REPO` exist, mirroring
 * `ai/providers/createProviderFromEnv.ts`. Called only from
 * `routes/index.ts`'s composition root; every test bypasses this entirely
 * by injecting a mock client via `ApiRouterDeps`.
 *
 * Synchronous, like `createGitHubClient()` itself — `GITHUB_TOKEN`/
 * `GITHUB_REPO` being unset (or `GITHUB_REPO` malformed) is a valid,
 * expected state in dev; publishing fails clearly the first time it's
 * actually attempted, rather than the whole API refusing to start. See
 * docs/github-integration.md#authentication.
 */
export function createGitHubClientFromEnv(env: NodeJS.ProcessEnv = process.env): GitHubClient {
  const parsed = parseRepo(env.GITHUB_REPO);
  if (parsed === null) {
    return createMisconfiguredClient(
      `GitHub is not configured: GITHUB_REPO must be set as "owner/repo" (got ${
        env.GITHUB_REPO === undefined ? 'unset' : JSON.stringify(env.GITHUB_REPO)
      }).`,
    );
  }

  const authProvider = createEnvTokenAuthProvider({ token: env.GITHUB_TOKEN });
  return createGitHubClient({ owner: parsed.owner, repo: parsed.repo, authProvider });
}

function parseRepo(value: string | undefined): { owner: string; repo: string } | null {
  if (!value) return null;
  const segments = value.split('/');
  if (segments.length !== 2) return null;
  const [owner, repo] = segments;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/** A `GitHubClient` whose every method rejects with the same clear configuration error — used when `GITHUB_REPO` is unset or malformed, so the failure is diagnosable instead of a confusing downstream 404 against `/repos//`. */
function createMisconfiguredClient(message: string): GitHubClient {
  const fail = (): Promise<never> => Promise.reject(new GitHubError('AUTH_FAILED', message));
  return { getRepository: fail, getFile: fail, writeFile: fail };
}
