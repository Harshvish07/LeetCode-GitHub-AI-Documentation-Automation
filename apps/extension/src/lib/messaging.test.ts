import { describe, expect, it } from 'vitest';
import { getExtensionStatusMessage } from './messaging.js';

describe('getExtensionStatusMessage', () => {
  it('returns a non-empty status string', () => {
    expect(getExtensionStatusMessage()).toContain('CodeReviewAI');
  });
});
