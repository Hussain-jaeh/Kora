import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fetch once, then poll. Keeps the last good data on the screen when a refresh
 * fails, so a dropped network shows stale figures rather than an empty screen.
 */
export function useApi(fetcher, { interval = 0, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, fetchedAt: null });
  const alive = useRef(true);
  const fn = useRef(fetcher);
  fn.current = fetcher;

  const load = useCallback(async () => {
    try {
      const data = await fn.current();
      if (alive.current) setState({ data, error: null, loading: false, fetchedAt: new Date() });
    } catch (error) {
      if (alive.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    if (!interval) return () => { alive.current = false; };
    const id = setInterval(load, interval);
    return () => { alive.current = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load };
}
