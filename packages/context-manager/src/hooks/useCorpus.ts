// =============================================================================
// useCorpus Hook
// =============================================================================
// Fetches the corpus overview: all 7 context types with their compiled file
// metadata, source counts, and priority tiers. Primary data hook for the
// corpus health view.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client.js';

// ---------------------------------------------------------------------------
// Re-export shared types so existing imports across context-manager stay stable
// ---------------------------------------------------------------------------

export type {
  ContextType,
  ContextPriority,
  SectionMeta,
  CompiledFileMeta,
  CorpusTypeEntry,
  CorpusResponse,
} from '@contextual/shared';

export { CONTEXT_TYPES, DEFAULT_PRIORITIES } from '@contextual/shared';

import type {
  ContextType,
  ContextPriority,
  CorpusResponse,
} from '@contextual/shared';
import { CONTEXT_TYPES, DEFAULT_PRIORITIES } from '@contextual/shared';

// ---------------------------------------------------------------------------
// Labels & descriptions
// ---------------------------------------------------------------------------

export const TYPE_LABELS: Record<ContextType, string> = {
  research: 'Research',
  taste: 'Taste',
  strategy: 'Strategy',
  'design-system': 'Design System',
  stakeholders: 'Stakeholders',
  technical: 'Technical',
  business: 'Business',
};

export const TYPE_DESCRIPTIONS: Record<ContextType, string> = {
  research: 'User research findings, competitive analysis, market insights',
  taste: 'Brand references, visual direction, tone and voice guidelines',
  strategy: 'Product strategy, roadmaps, positioning documents',
  'design-system': 'Components, tokens, patterns, design principles',
  stakeholders: 'Stakeholder requirements, feedback, approval criteria',
  technical: 'Architecture considerations, technical constraints, API specs',
  business: 'Business requirements, models, revenue considerations',
};

export const PRIORITY_LABELS: Record<ContextPriority, string> = {
  system: 'System',
  project: 'Project',
  reference: 'Reference',
};

export const PRIORITY_DESCRIPTIONS: Record<ContextPriority, string> = {
  system: 'Always fully loaded by the agent',
  project: 'Selectively loaded based on project brief',
  reference: 'Available on demand when needed',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseCorpusReturn {
  data: CorpusResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCorpus(): UseCorpusReturn {
  const [data, setData] = useState<CorpusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setIsLoading(!hasLoadedRef.current);
    setError(null);

    try {
      const res = await apiFetch('/api/corpus');
      if (!res.ok) throw new Error(`Failed to fetch corpus: ${res.status}`);
      const json = await res.json() as CorpusResponse;

      // Ensure priority is populated (backcompat with middleware that doesn't send it yet)
      const normalized: CorpusResponse = {
        ...json,
        types: json.types.map((entry) => ({
          ...entry,
          priority: entry.priority ?? DEFAULT_PRIORITIES[entry.type],
        })),
      };

      setData(normalized);
      hasLoadedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load corpus';
      setError(message);

      // Fallback: show empty state so UI renders while middleware is being built
      setData({
        contextRoot: './context',
        types: CONTEXT_TYPES.map((type) => ({
          type,
          exists: false,
          meta: null,
          sourceCount: 0,
          priority: DEFAULT_PRIORITIES[type],
        })),
        totalTokenEstimate: 0,
      });
      hasLoadedRef.current = true;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let fetching = false;
    void fetchData().then(() => { if (!active) return; });

    // Poll every 5 seconds to detect external file changes (files added outside the UI).
    // Guard against overlapping fetches if the previous one is still in-flight.
    const interval = setInterval(() => {
      if (active && !fetching) {
        fetching = true;
        void fetchData().finally(() => { fetching = false; });
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
