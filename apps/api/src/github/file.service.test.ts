import { describe, expect, it } from 'vitest';
import { GitHubError } from './errors.js';
import { createFailingGitHubClient, createInMemoryGitHubClient } from './mockGitHubClient.js';
import { FileService } from './file.service.js';

describe('FileService.findExisting', () => {
  it('returns null when the file does not exist (duplicate-detection: nothing found)', async () => {
    const client = createInMemoryGitHubClient();
    const service = new FileService(client);

    await expect(service.findExisting('problems/001-two-sum/README.md')).resolves.toBeNull();
  });

  it('returns the file content and sha when it exists (duplicate-detection: found)', async () => {
    const client = createInMemoryGitHubClient({
      'problems/001-two-sum/README.md': '# old content',
    });
    const service = new FileService(client);

    const result = await service.findExisting('problems/001-two-sum/README.md');

    expect(result).not.toBeNull();
    expect(result?.content).toBe('# old content');
    expect(result?.sha).toBeTruthy();
  });
});

describe('FileService.create', () => {
  it('writes a new file without a sha (file creation)', async () => {
    const client = createInMemoryGitHubClient();
    const service = new FileService(client);

    const result = await service.create(
      'problems/001-two-sum/README.md',
      '# Two Sum',
      'docs: add analysis for Two Sum',
    );

    expect(result.sha).toBeTruthy();
    expect(client.writeInputs[0]?.sha).toBeUndefined();
    await expect(service.findExisting('problems/001-two-sum/README.md')).resolves.toMatchObject({
      content: '# Two Sum',
    });
  });
});

describe('FileService.update', () => {
  it('writes an existing file with its current sha (file update)', async () => {
    const client = createInMemoryGitHubClient({ 'problems/001-two-sum/README.md': '# old' });
    const service = new FileService(client);
    const existing = await service.findExisting('problems/001-two-sum/README.md');

    const result = await service.update(
      'problems/001-two-sum/README.md',
      '# new',
      'docs: update analysis for Two Sum',
      existing!.sha,
    );

    expect(result.sha).toBeTruthy();
    expect(client.writeInputs[0]?.sha).toBe(existing!.sha);
    await expect(service.findExisting('problems/001-two-sum/README.md')).resolves.toMatchObject({
      content: '# new',
    });
  });
});

describe('FileService — API errors', () => {
  it('propagates a rate-limit GitHubError unchanged', async () => {
    const client = createFailingGitHubClient(new GitHubError('RATE_LIMITED', 'slow down'));
    const service = new FileService(client);

    await expect(service.findExisting('any/path.md')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('propagates a generic API error unchanged on write', async () => {
    const client = createFailingGitHubClient(new GitHubError('API_ERROR', 'upstream 500'));
    const service = new FileService(client);

    await expect(service.create('any/path.md', 'content', 'docs: add x')).rejects.toMatchObject({
      code: 'API_ERROR',
    });
  });
});
