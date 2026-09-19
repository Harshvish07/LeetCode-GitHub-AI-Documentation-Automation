import { describe, expect, it } from 'vitest';
import { GitHubError } from './errors.js';
import { createFailingGitHubClient, createInMemoryGitHubClient } from './mockGitHubClient.js';
import { RepositoryService } from './repository.service.js';

describe('RepositoryService.ensureAccessible', () => {
  it('returns the repository info on success (repository lookup)', async () => {
    const client = createInMemoryGitHubClient({}, { defaultBranch: 'main' });
    const service = new RepositoryService(client);

    const result = await service.ensureAccessible();

    expect(result).toEqual({
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/mock/mock',
    });
  });

  it('propagates a NOT_FOUND GitHubError unchanged when the repository does not exist', async () => {
    const client = createFailingGitHubClient(new GitHubError('NOT_FOUND', 'no such repo'));
    const service = new RepositoryService(client);

    await expect(service.ensureAccessible()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('propagates an AUTH_FAILED GitHubError unchanged (authentication failure)', async () => {
    const client = createFailingGitHubClient(new GitHubError('AUTH_FAILED', 'bad token'));
    const service = new RepositoryService(client);

    await expect(service.ensureAccessible()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });
});
