import { useEffect, useState } from 'react';
import { fetchPreviousProjects } from '../api/localFiles.js';
import type { PreviousProjectsResponse } from '../types.js';

export function usePreviousProjects() {
  const [data, setData] = useState<PreviousProjectsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const next = await fetchPreviousProjects();
        if (!active) return;
        setData(next);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load previous projects');
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
