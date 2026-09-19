import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from './useAsync.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsync', () => {
  it('starts loading, then reports the data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve('hello'), []));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current).toMatchObject({ status: 'success', data: 'hello' });
  });

  it('reports an error with its message', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('nope')), []));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({ status: 'error', message: 'nope' });
  });

  it('uses a generic message for a non-Error rejection', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject('string'), []));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({ message: 'Something went wrong.' });
  });

  it('ignores a slow earlier response that arrives after the inputs changed', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(
      ({ key }) => useAsync(() => (key === 'a' ? first.promise : second.promise), [key]),
      {
        initialProps: { key: 'a' },
      },
    );

    rerender({ key: 'b' });
    await act(async () => second.resolve('second'));
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'success', data: 'second' }),
    );
    await act(async () => first.resolve('first (stale)'));

    expect(result.current).toMatchObject({ status: 'success', data: 'second' });
  });

  it('keeps showing previous data while refetching', async () => {
    const next = deferred<string>();
    let call = 0;
    const { result, rerender } = renderHook(
      ({ key }) => useAsync(() => (call++ === 0 ? Promise.resolve('one') : next.promise), [key]),
      {
        initialProps: { key: 1 },
      },
    );
    await waitFor(() => expect(result.current.status).toBe('success'));

    rerender({ key: 2 });

    expect(result.current).toMatchObject({ status: 'success', data: 'one' });
    await act(async () => next.resolve('two'));
    await waitFor(() => expect(result.current).toMatchObject({ data: 'two' }));
  });

  it('reload re-runs the request', async () => {
    let calls = 0;
    const { result } = renderHook(() => useAsync(() => Promise.resolve(++calls), []));
    await waitFor(() => expect(result.current.status).toBe('success'));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current).toMatchObject({ status: 'success', data: 2 }));
  });
});
