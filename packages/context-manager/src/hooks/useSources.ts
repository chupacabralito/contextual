// =============================================================================
// useSources Hook
// =============================================================================
// Fetches and manages raw source files for a specific context type.
// Supports listing, adding (paste), and deleting sources.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { ContextType } from './useCorpus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceFile {
  filename: string;
  size: number;
  preview: string;
  addedAt: string;
}

export interface SourceListResponse {
  type: ContextType;
  sources: SourceFile[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSourcesOptions {
  type: ContextType | null;
}

interface UseSourcesReturn {
  sources: SourceFile[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addSource: (content: string, label?: string, filename?: string) => Promise<void>;
  deleteSource: (filename: string) => Promise<void>;
}

export function useSources({ type }: UseSourcesOptions): UseSourcesReturn {
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    if (!type) {
      setSources([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sources`);
      if (!res.ok) throw new Error(`Failed to fetch sources: ${res.status}`);
      const json: SourceListResponse = await res.json();
      setSources(json.sources);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sources';
      setError(message);
      setSources([]);
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  useEffect(() => {
    let active = true;
    void fetchSources().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [fetchSources]);

  const addSource = useCallback(
    async (content: string, label?: string, filename?: string) => {
      if (!type) return;

      try {
        const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, label, filename }),
        });
        if (!res.ok) throw new Error(`Failed to add source: ${res.status}`);
        // Refetch to get updated list
        await fetchSources();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add source';
        setError(message);
        throw err;
      }
    },
    [type, fetchSources]
  );

  const deleteSource = useCallback(
    async (filename: string) => {
      if (!type) return;

      try {
        const res = await fetch(
          `/api/corpus/${encodeURIComponent(type)}/sources/${encodeURIComponent(filename)}`,
          { method: 'DELETE' }
        );
        if (!res.ok) throw new Error(`Failed to delete source: ${res.status}`);
        await fetchSources();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete source';
        setError(message);
        throw err;
      }
    },
    [type, fetchSources]
  );

  return { sources, isLoading, error, refetch: fetchSources, addSource, deleteSource };
}
