import { describe, expect, it } from 'vitest';
import { createEnvTokenAuthProvider } from './auth.js';

describe('createEnvTokenAuthProvider', () => {
  it('resolves the configured token', async () => {
    const provider = createEnvTokenAuthProvider({ token: 'ghp_example' });

    await expect(provider.getToken()).resolves.toBe('ghp_example');
  });

  it('rejects with AUTH_FAILED when no token is configured', async () => {
    const provider = createEnvTokenAuthProvider({ token: undefined });

    await expect(provider.getToken()).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });
});
