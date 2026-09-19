import { describe, expect, it } from 'vitest';
import { parseRoute, problemPath } from './routes.js';

describe('parseRoute', () => {
  it.each(['', '#', '#/', '#/dashboard'])('maps "%s" to the dashboard', (hash) => {
    expect(parseRoute(hash)).toEqual({ name: 'dashboard' });
  });

  it('maps the problem list, tolerating a trailing slash', () => {
    expect(parseRoute('#/problems')).toEqual({ name: 'problems' });
    expect(parseRoute('#/problems/')).toEqual({ name: 'problems' });
  });

  it('maps a problem detail route and decodes its id', () => {
    expect(parseRoute('#/problems/abc-123')).toEqual({ name: 'problem', id: 'abc-123' });
    expect(parseRoute('#/problems/a%20b')).toEqual({ name: 'problem', id: 'a b' });
  });

  it('maps anything else to not-found', () => {
    expect(parseRoute('#/nope')).toEqual({ name: 'not-found' });
    expect(parseRoute('#/problems/a/b')).toEqual({ name: 'not-found' });
  });
});

describe('problemPath', () => {
  it('builds a detail link that round-trips through parseRoute', () => {
    expect(parseRoute(problemPath('id with/slash'))).toEqual({
      name: 'problem',
      id: 'id with/slash',
    });
  });
});
