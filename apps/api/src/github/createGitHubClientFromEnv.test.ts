import { describe, expect, it } from 'vitest';
import { createGitHubClientFromEnv } from './createGitHubClientFromEnv.js';

describe('createGitHubClientFromEnv', () => {
  it('returns a usable client when GITHUB_REPO and GITHUB_TOKEN are both set', () => {
    const client = createGitHubClientFromEnv({ GITHUB_REPO: 'me/journal', GITHUB_TOKEN: 'ghp_x' });

    expect(client).toBeDefined();
    expect(typeof client.getRepository).toBe('function');
  });

  it('rejects with a clear config error on the first call when GITHUB_REPO is unset', async () => {
    const client = createGitHubClientFromEnv({});

    await expect(client.getRepository()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('rejects with a clear config error when GITHUB_REPO has no slash', async () => {
    const client = createGitHubClientFromEnv({ GITHUB_REPO: 'not-a-valid-repo' });

    await expect(client.getFile('x')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('rejects when GITHUB_REPO has too many segments', async () => {
    const client = createGitHubClientFromEnv({ GITHUB_REPO: 'a/b/c' });

    await expect(client.getRepository()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('never throws synchronously, even when misconfigured (the API must still start)', () => {
    expect(() => createGitHubClientFromEnv({})).not.toThrow();
  });
});
