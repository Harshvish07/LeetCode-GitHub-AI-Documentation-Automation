import { describe, expect, it } from 'vitest';
import { CommitService } from './commit.service.js';

describe('CommitService.buildMessage', () => {
  const service = new CommitService();

  it('builds the exact example message from the task for a new problem', () => {
    expect(service.buildMessage({ action: 'add-problem', title: 'Two Sum' })).toBe(
      'docs: add analysis for Two Sum',
    );
  });

  it('builds a distinct message for updating an existing problem', () => {
    expect(service.buildMessage({ action: 'update-problem', title: 'Two Sum' })).toBe(
      'docs: update analysis for Two Sum',
    );
  });

  it('builds a message for the problems index', () => {
    expect(service.buildMessage({ action: 'update-index', title: 'Two Sum' })).toBe(
      'docs: update problems index for Two Sum',
    );
  });

  it('builds a fixed message for the README, ignoring any title', () => {
    expect(service.buildMessage({ action: 'update-readme' })).toBe(
      'docs: update problems README index',
    );
  });

  it('never produces a generic, meaningless message', () => {
    const messages = [
      service.buildMessage({ action: 'add-problem', title: 'Two Sum' }),
      service.buildMessage({ action: 'update-problem', title: 'Two Sum' }),
      service.buildMessage({ action: 'update-index', title: 'Two Sum' }),
      service.buildMessage({ action: 'update-readme' }),
    ];
    for (const message of messages) {
      expect(message.toLowerCase()).not.toMatch(/^update files?$|^wip$|^fix$|^changes$/);
    }
  });

  it('normalizes whitespace in the title', () => {
    expect(service.buildMessage({ action: 'add-problem', title: '  Two   Sum  ' })).toBe(
      'docs: add analysis for Two Sum',
    );
  });

  it('falls back to a generic-but-still-meaningful phrase when title is missing', () => {
    expect(service.buildMessage({ action: 'add-problem' })).toBe(
      'docs: add analysis for this problem',
    );
  });
});
