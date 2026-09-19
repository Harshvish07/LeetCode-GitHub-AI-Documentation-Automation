import { AppHeader } from './components/layout/AppHeader.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LearningPage } from './pages/LearningPage.js';
import { ProblemDetailPage } from './pages/ProblemDetailPage.js';
import { ProblemsPage } from './pages/ProblemsPage.js';
import { useHashRoute, type Route } from './router/routes.js';

function renderRoute(route: Route) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />;
    case 'problems':
      return <ProblemsPage />;
    case 'learning':
      return <LearningPage />;
    case 'problem':
      return <ProblemDetailPage key={route.id} submissionId={route.id} />;
    case 'not-found':
      return (
        <p className="state-message">
          Page not found. <a href="#/">Back to the dashboard</a>
        </p>
      );
  }
}

export function App() {
  const route = useHashRoute();

  return (
    <div className="app-shell">
      <AppHeader route={route} />
      <main className="app-main">{renderRoute(route)}</main>
    </div>
  );
}
