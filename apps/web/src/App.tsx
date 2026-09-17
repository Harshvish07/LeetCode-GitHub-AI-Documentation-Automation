import type { ApiResponse, HealthStatus } from '@codereviewai/shared';
import { useEffect, useState } from 'react';

type HealthState =
  | { phase: 'loading' }
  | { phase: 'online'; health: HealthStatus }
  | { phase: 'offline'; message: string };

export function App() {
  const [healthState, setHealthState] = useState<HealthState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then(async (res) => {
        const body = (await res.json()) as ApiResponse<HealthStatus>;
        if (cancelled) return;

        if (body.success) {
          setHealthState({ phase: 'online', health: body.data });
        } else {
          setHealthState({ phase: 'offline', message: body.error.message });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthState({ phase: 'offline', message: 'Unable to reach the API' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <h1 style={{color: 'black'}}>CodeReviewAI</h1>
      <p className="tagline">AI-Powered LeetCode Solution Analyzer</p>

      <section className="status-card">
        <h2>Phase 1 — Project Foundation</h2>
        <p>This page confirms the frontend, backend and shared package are wired together.</p>
        <p data-testid="health-status">
          Backend status: <strong>{describeHealthState(healthState)}</strong>
        </p>
      </section>
    </main>
  );
}

function describeHealthState(state: HealthState): string {
  switch (state.phase) {
    case 'loading':
      return 'checking...';
    case 'online':
      return `online (uptime ${Math.round(state.health.uptimeSeconds)}s)`;
    case 'offline':
      return `offline (${state.message})`;
  }
}
