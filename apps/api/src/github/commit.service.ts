/**
 * Commit-message construction — kept as pure, isolated string-building
 * (like `ai/prompts/reviewPrompt.ts`), never inlined at the call site, so
 * "what does a commit for X look like" has exactly one place to read and
 * test. Every message follows Conventional Commits' `docs:` prefix and
 * names the specific problem, satisfying the task's "create meaningful
 * commits... do not create meaningless commit messages" requirement —
 * there is no code path in this system that can produce a generic message
 * like "update files".
 */
export type CommitAction = 'add-problem' | 'update-problem' | 'update-index' | 'update-readme';

export interface BuildCommitMessageInput {
  action: CommitAction;
  /** The problem's title — required for every action except `update-readme`, which touches every problem at once and can't name just one. */
  title?: string;
}

export class CommitService {
  buildMessage(input: BuildCommitMessageInput): string {
    if (input.action === 'update-readme') {
      return 'docs: update problems README index';
    }

    const title = normalizeTitle(input.title);

    switch (input.action) {
      case 'add-problem':
        return `docs: add analysis for ${title}`;
      case 'update-problem':
        return `docs: update analysis for ${title}`;
      case 'update-index':
        return `docs: update problems index for ${title}`;
    }
  }
}

function normalizeTitle(title: string | undefined): string {
  const trimmed = (title ?? '').trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : 'this problem';
}
