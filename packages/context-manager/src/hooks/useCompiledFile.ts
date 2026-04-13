// =============================================================================
// useCompiledFile Hook
// =============================================================================
// Fetches and manages the compiled markdown file for a specific context type.
// Supports reading the full compiled content and updating it.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';
import type { ContextType, CompiledFileMeta } from './useCorpus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompiledFileResponse {
  meta: CompiledFileMeta;
  content: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseCompiledFileOptions {
  type: ContextType | null;
}

interface UseCompiledFileReturn {
  meta: CompiledFileMeta | null;
  content: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateCompiled: (content: string) => Promise<void>;
}

export function useCompiledFile({ type }: UseCompiledFileOptions): UseCompiledFileReturn {
  const [meta, setMeta] = useState<CompiledFileMeta | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompiled = useCallback(async () => {
    if (!type) {
      setMeta(null);
      setContent(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/corpus/${encodeURIComponent(type)}`);
      if (res.status === 404) {
        // No compiled file yet -- not an error, just empty
        setMeta(null);
        setContent(null);
        return;
      }
      if (!res.ok) throw new Error(`Failed to fetch compiled file: ${res.status}`);
      const json: CompiledFileResponse = await res.json();
      setMeta(json.meta);
      setContent(json.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load compiled file';
      setError(message);
      setMeta(null);
      setContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  useEffect(() => {
    let active = true;
    void fetchCompiled().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [fetchCompiled]);

  const updateCompiled = useCallback(
    async (newContent: string) => {
      if (!type) return;

      try {
        const res = await apiFetch(`/api/corpus/${encodeURIComponent(type)}/compiled`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent }),
        });
        if (!res.ok) throw new Error(`Failed to update compiled file: ${res.status}`);
        await fetchCompiled();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update compiled file';
        setError(message);
        throw err;
      }
    },
    [type, fetchCompiled]
  );

  return { meta, content, isLoading, error, refetch: fetchCompiled, updateCompiled };
}
