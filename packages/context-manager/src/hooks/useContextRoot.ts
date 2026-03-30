import { useEffect, useState } from 'react';
import { fetchContextRoot } from '../api/localFiles.js';
import type { ContextRootResponse } from '../types.js';

export function useContextRoot() {
  const [data, setData] = useState<ContextRootResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const next = await fetchContextRoot();
        if (!active) return;
        setData(next);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load context root');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { data, isLoading, error };
}
