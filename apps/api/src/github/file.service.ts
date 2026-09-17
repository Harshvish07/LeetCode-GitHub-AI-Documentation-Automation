import type { GitHubClient, GitHubFile, WriteFileResult } from './types.js';

/**
 * File-level GitHub operations — the building block duplicate detection is
 * built on (`findExisting()` returning non-null means the path is already
 * taken) and the one place that decides, mechanically, whether a write is a
 * create (`sha` omitted) or an update (`sha` included) based on what's
 * currently there. The actual create-vs-update *policy* — whether an
 * update is allowed for this request — lives one layer up, in
 * `services/github-publish.service.ts`; this class only ever does what
 * it's told.
 */
export class FileService {
  constructor(private readonly client: GitHubClient) {}

  async findExisting(path: string): Promise<GitHubFile | null> {
    return this.client.getFile(path);
  }

  async create(path: string, content: string, message: string): Promise<WriteFileResult> {
    return this.client.writeFile({ path, content, message });
  }

  async update(
    path: string,
    content: string,
    message: string,
    sha: string,
  ): Promise<WriteFileResult> {
    return this.client.writeFile({ path, content, message, sha });
  }
}
