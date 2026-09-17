import { GitHubError } from './errors.js';
import type { GitHubAuthProvider } from './types.js';

/**
 * The MVP `GitHubAuthProvider`: a single long-lived personal access token
 * (or GitHub App installation token) read once from `GITHUB_TOKEN`. The task
 * requires "never store GitHub tokens in source code" and "use environment
 * variables for the MVP" — this is the one place that reads the env var.
 *
 * A future OAuth provider (per-user tokens, refreshed on expiry) would be a
 * new function implementing the same `GitHubAuthProvider` interface —
 * `getToken()` becoming `async` was a deliberate choice even though this
 * implementation resolves synchronously, so a future implementation that
 * needs to refresh a token over the network doesn't change the interface.
 * See docs/github-integration.md#future-oauth-design.
 */
export function createEnvTokenAuthProvider(config: {
  token: string | undefined;
}): GitHubAuthProvider {
  return {
    async getToken(): Promise<string> {
      if (!config.token) {
        throw new GitHubError('AUTH_FAILED', 'GitHub is not configured: GITHUB_TOKEN is not set.');
      }
      return config.token;
    },
  };
}
