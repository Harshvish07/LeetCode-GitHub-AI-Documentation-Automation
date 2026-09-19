import { describe, expect, it } from 'vitest';
import { createDatabaseFromEnv, shouldUseSsl } from './createDatabaseFromEnv.js';

describe('createDatabaseFromEnv', () => {
  it('returns null when DATABASE_URL is unset or blank', () => {
    expect(createDatabaseFromEnv({})).toBeNull();
    expect(createDatabaseFromEnv({ DATABASE_URL: '  ' })).toBeNull();
  });
});

describe('shouldUseSsl', () => {
  const supabase = 'postgresql://postgres:pw@db.abcdef.supabase.co:5432/postgres';
  const pooler =
    'postgresql://postgres.abcdef:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

  it('is on by default for Supabase hosts, including the pooler', () => {
    expect(shouldUseSsl(supabase, {})).toBe(true);
    expect(shouldUseSsl(pooler, {})).toBe(true);
  });

  it('is off by default for other hosts', () => {
    expect(shouldUseSsl('postgres://u:p@localhost:5432/db', {})).toBe(false);
    expect(shouldUseSsl('postgres://u:p@notsupabase.co.evil.example/db', {})).toBe(false);
  });

  it('honors an explicit DATABASE_SSL either way', () => {
    expect(shouldUseSsl('postgres://u:p@localhost/db', { DATABASE_SSL: 'true' })).toBe(true);
    expect(shouldUseSsl(supabase, { DATABASE_SSL: 'false' })).toBe(false);
  });

  it('does not throw on an unparseable URL', () => {
    expect(shouldUseSsl('not a url', {})).toBe(false);
  });
});
