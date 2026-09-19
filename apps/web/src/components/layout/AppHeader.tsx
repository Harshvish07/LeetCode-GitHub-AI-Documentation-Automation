import type { Route } from '../../router/routes.js';
import { BackendStatus } from './BackendStatus.js';

const LINKS = [
  { href: '#/', label: 'Dashboard', active: (route: Route) => route.name === 'dashboard' },
  {
    href: '#/problems',
    label: 'Problems',
    active: (route: Route) => route.name === 'problems' || route.name === 'problem',
  },
  { href: '#/learning', label: 'Learning', active: (route: Route) => route.name === 'learning' },
];

export function AppHeader({ route }: { route: Route }) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <h1>CodeReviewAI</h1>
        <p className="tagline">AI-Powered LeetCode Solution Analyzer</p>
      </div>
      <nav aria-label="Main">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={link.active(route) ? 'page' : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <BackendStatus />
    </header>
  );
}
