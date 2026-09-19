import type { ApiResponse, HealthStatus } from '@codereviewai/shared';
import { useEffect, useState } from 'react';

type HealthState =
  | { phase: 'loading' }
  | { phase: 'online'; health: HealthStatus }
  | { phase: 'offline'; message: string };

/** A small "is the API reachable" indicator — the Phase 1 health check, kept as a header widget. */
export function BackendStatus() {
  const [state, setState] = useState<HealthState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/health')
      .then(async (res) => {
        const body = (await res.json()) as ApiResponse<HealthStatus>;
        if (cancelled) return;
        if (body.success) setState({ phase: 'online', health: body.data });
        else setState({ phase: 'offline', message: body.error.message });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'offline', message: 'Unable to reach the API' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className={`backend-status backend-${state.phase}`} data-testid="health-status">
      Backend status: <strong>{describe(state)}</strong>
    </p>
  );
}

function describe(state: HealthState): string {
  switch (state.phase) {
    case 'loading':
      return 'checking...';
    case 'online':
      return `online (uptime ${Math.round(state.health.uptimeSeconds)}s)`;
    case 'offline':
      return `offline (${state.message})`;
  }
}
