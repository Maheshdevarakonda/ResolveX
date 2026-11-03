import { DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/client";

// Loads data when the component appears (and whenever `deps` change). `reload` fetches again
// without flashing the loading state, which keeps live-updating pages from blinking.
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latest = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (showSpinner: boolean) => {
    const id = ++latest.current; // ignore out-of-order responses
    if (showSpinner) setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === latest.current) { setData(result); setError(""); }
    } catch (err) {
      if (id === latest.current) setError(getErrorMessage(err));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void run(true); }, deps);
  const reload = useCallback(() => void run(false), [run]);
  const retry = useCallback(() => void run(true), [run]);
  return { data, loading, error, reload, retry, setData };
}
