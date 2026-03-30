import { useEffect, useState } from 'react';
import { fetchRepository } from '../api/repository.js';
import type { RepositoryResponse } from '../types.js';

export function useRepository() {
  const [data, setData] = useState<RepositoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const result = await fetchRepository();
        if (!active) return;
        setData(result);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load repository');
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { data, isLoading, error };
}
