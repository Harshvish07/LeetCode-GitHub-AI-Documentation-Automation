import { describe, expect, it, vi } from 'vitest';
import { createEnvTokenAuthProvider } from './auth.js';
import { createGitHubClient } from './github-client.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function authProvider(token: string | undefined = 'test-token') {
  return createEnvTokenAuthProvider({ token });
}

describe('createGitHubClient', () => {
  it('is a synchronous factory that never touches fetch or a token until a method is called', () => {
    const fetchSpy = vi.fn();

    const client = createGitHubClient({
      owner: 'me',
      repo: 'journal',
      authProvider: createEnvTokenAuthProvider({ token: undefined }),
      fetch: fetchSpy,
    });

    expect(client).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails clearly on the first call when no token is configured (authentication failure)', async () => {
    const fetchSpy = vi.fn();
    const client = createGitHubClient({
      owner: 'me',
      repo: 'journal',
      authProvider: createEnvTokenAuthProvider({ token: undefined }),
      fetch: fetchSpy,
    });

    await expect(client.getRepository()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  describe('getRepository', () => {
    it('returns the default branch on success (repository lookup)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { default_branch: 'main' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      const result = await client.getRepository();

      expect(result).toEqual({ defaultBranch: 'main' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0] as [string];
      expect(url).toContain('/repos/me/journal');
    });

    it('raises AUTH_FAILED on an HTTP 401 (authentication failure)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Bad credentials' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await expect(client.getRepository()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    });

    it('raises NOT_FOUND on an HTTP 404 (API error: repository does not exist)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(404, { message: 'Not Found' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await expect(client.getRepository()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('raises RATE_LIMITED on an HTTP 403 (API error)', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(jsonResponse(403, { message: 'API rate limit exceeded' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await expect(client.getRepository()).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    });

    it('raises API_ERROR on an unexpected HTTP 500', async () => {
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { message: 'Internal Server Error' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await expect(client.getRepository()).rejects.toMatchObject({ code: 'API_ERROR' });
    });

    it('reuses the same authenticated client across multiple calls (token fetched once)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { default_branch: 'main' }));
      let tokenCalls = 0;
      const provider = {
        async getToken() {
          tokenCalls++;
          return 'test-token';
        },
      };
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: provider,
        fetch: fetchSpy,
      });

      await client.getRepository();
      await client.getRepository();

      expect(tokenCalls).toBe(1);
    });
  });

  describe('getFile', () => {
    it('returns decoded content and sha when the file exists', async () => {
      const content = Buffer.from('# Two Sum', 'utf-8').toString('base64');
      const fetchSpy = vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { type: 'file', content, sha: 'abc123' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      const result = await client.getFile('problems/001-two-sum/README.md');

      expect(result).toEqual({ content: '# Two Sum', sha: 'abc123' });
    });

    it('returns null (not a thrown error) on an HTTP 404', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(404, { message: 'Not Found' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await expect(client.getFile('does/not/exist.md')).resolves.toBeNull();
    });
  });

  describe('writeFile', () => {
    it('creates a file without a sha and returns the new sha/commit info', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        jsonResponse(201, {
          content: { sha: 'new-sha' },
          commit: {
            sha: 'commit-sha',
            html_url: 'https://github.com/me/journal/commit/commit-sha',
          },
        }),
      );
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      const result = await client.writeFile({
        path: 'problems/001-two-sum/README.md',
        content: '# Two Sum',
        message: 'docs: add analysis for Two Sum',
      });

      expect(result).toEqual({
        sha: 'new-sha',
        commitSha: 'commit-sha',
        commitUrl: 'https://github.com/me/journal/commit/commit-sha',
      });
      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(options.method).toBe('PUT');
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.sha).toBeUndefined();
      expect(body.message).toBe('docs: add analysis for Two Sum');
      expect(Buffer.from(body.content as string, 'base64').toString('utf-8')).toBe('# Two Sum');
    });

    it('includes the sha when updating an existing file', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: { sha: 'updated-sha' },
          commit: {
            sha: 'commit-sha-2',
            html_url: 'https://github.com/me/journal/commit/commit-sha-2',
          },
        }),
      );
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await client.writeFile({
        path: 'problems/001-two-sum/README.md',
        content: '# Two Sum v2',
        message: 'docs: update analysis for Two Sum',
        sha: 'old-sha',
      });

      const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body.sha).toBe('old-sha');
    });

    it('raises CONFLICT on an HTTP 409 (concurrent modification)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(409, { message: 'Conflict' }));
      const client = createGitHubClient({
        owner: 'me',
        repo: 'journal',
        authProvider: authProvider(),
        fetch: fetchSpy,
      });

      await expect(
        client.writeFile({ path: 'a.md', content: 'x', message: 'docs: add analysis for X' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });
});
