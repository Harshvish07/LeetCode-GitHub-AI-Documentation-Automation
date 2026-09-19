import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; message: string };

interface Settled<T> {
  /** Which request (deps + reload attempt) produced this result. */
  requestKey: string;
  state: Exclude<AsyncState<T>, { status: 'loading' }>;
}

/**
 * Runs `load` whenever `deps` change and tracks its loading/success/error
 * state. `deps` must be JSON-serializable (strings, numbers, plain
 * objects) — they identify the request. A response that arrives after the
 * inputs changed (or after unmount) is ignored, so a slow earlier request
 * can never overwrite a newer one — which matters for filters that refetch
 * on every keystroke. While a newer request is in flight the previous
 * *successful* data stays on screen (no flicker); a previous error does not.
 * `reload` re-runs the current request on demand.
 *
 * "Loading" is derived (no result yet for the current request key) rather
 * than set from inside the effect.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> & { reload: () => void } {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${JSON.stringify(deps)}#${attempt}`;

  useEffect(() => {
    let cancelled = false;

    load()
      .then((data) => {
        if (!cancelled) setSettled({ requestKey, state: { status: 'success', data } });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSettled({
            requestKey,
            state: {
              status: 'error',
              message: error instanceof Error ? error.message : 'Something went wrong.',
            },
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency: the request is identified by `requestKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  let state: AsyncState<T> = { status: 'loading' };
  if (settled) {
    if (settled.requestKey === requestKey) state = settled.state;
    else if (settled.state.status === 'success') state = settled.state;
  }

  return { ...state, reload };
}
