import type { ReactNode } from 'react';
import type { AsyncState } from '../../hooks/useAsync.js';

export function LoadingMessage({ what = 'data' }: { what?: string }) {
  return (
    <p className="state-message" role="status">
      Loading {what}…
    </p>
  );
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-message state-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="state-message muted">{children}</p>;
}

/** Renders the right one of loading / error / content for an `AsyncState`. */
export function Loadable<T>({
  state,
  what,
  onRetry,
  children,
}: {
  state: AsyncState<T>;
  what?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading') return <LoadingMessage what={what} />;
  if (state.status === 'error') return <ErrorMessage message={state.message} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}
