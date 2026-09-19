import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'problems' }
  | { name: 'learning' }
  | { name: 'problem'; id: string }
  | { name: 'not-found' };

/**
 * Maps a URL hash to a route. Hash routing (`#/problems/<id>`) keeps the
 * dashboard a plain static site — no server-side fallback rules and no
 * router dependency — which is all a small dashboard needs.
 */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '' || path === 'dashboard') return { name: 'dashboard' };
  if (path === 'problems') return { name: 'problems' };
  if (path === 'learning') return { name: 'learning' };

  const detail = /^problems\/([^/]+)$/.exec(path);
  if (detail) return { name: 'problem', id: decodeURIComponent(detail[1]!) };

  return { name: 'not-found' };
}

export function problemPath(submissionId: string): string {
  return `#/problems/${encodeURIComponent(submissionId)}`;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  const update = useCallback(() => setRoute(parseRoute(window.location.hash)), []);
  useEffect(() => {
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [update]);

  return route;
}
