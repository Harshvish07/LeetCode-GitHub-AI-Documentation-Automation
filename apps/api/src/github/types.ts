/**
 * The one interface every GitHub-facing service depends on — never a
 * concrete Octokit type. Mirrors `ai/providers/types.ts`'s `AiProvider`
 * pattern exactly: one real implementation (`github-client.ts`, the only
 * file in this codebase that imports `@octokit/rest`) and one test-only
 * mock (`mockGitHubClient.ts`), so nothing above this layer ever needs to
 * know or care that GitHub is involved at all — a future replacement (a
 * self-hosted Git server, a different API version) is a new file
 * implementing this same interface.
 */
export interface GitHubRepositoryInfo {
  defaultBranch: string;
  /** The repository's browsable URL, e.g. https://github.com/owner/repo — used to build links to published files. */
  htmlUrl: string;
}

/** A file's current content and sha, as read from the repository — the sha is required by GitHub's Contents API to update (not create) a file, so its presence here is also how callers know whether to update or create it. */
export interface GitHubFile {
  content: string;
  sha: string;
}

export interface WriteFileInput {
  path: string;
  content: string;
  message: string;
  /** Omit to create a new file; pass the current file's sha (from `getFile()`) to update it. GitHub's Contents API rejects a create request for a path that already exists, and rejects an update request missing the current sha — this field is how a caller expresses which one it means. */
  sha?: string;
}

export interface WriteFileResult {
  /** The written file's new sha, for a subsequent update. */
  sha: string;
  commitSha: string;
  commitUrl: string;
}

export interface GitHubClient {
  getRepository(): Promise<GitHubRepositoryInfo>;
  /** Returns `null` (not a thrown error) when the file simply doesn't exist yet — that's an expected, common case (a problem being published for the first time), not a failure. */
  getFile(path: string): Promise<GitHubFile | null>;
  writeFile(input: WriteFileInput): Promise<WriteFileResult>;
}

/**
 * Abstracts *how* a GitHub token is obtained, kept separate from
 * `GitHubClient` (which is about what you can *do* once authenticated) so a
 * future OAuth flow (refreshable, per-user tokens) is a new implementation
 * of this interface, not a change to `github-client.ts`'s request logic —
 * see docs/github-integration.md#future-oauth-design.
 */
export interface GitHubAuthProvider {
  getToken(): Promise<string>;
}
