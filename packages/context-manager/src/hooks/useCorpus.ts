// =============================================================================
// useCorpus Hook
// =============================================================================
// Fetches the corpus overview: all 7 context types with their compiled file
// metadata and source counts. Primary data hook for the dashboard.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Inline types (mirror the shared contract until Codex wires up types.ts)
// ---------------------------------------------------------------------------

export type ContextType =
  | 'research'
  | 'taste'
  | 'strategy'
  | 'design-system'
  | 'stakeholders'
  | 'technical'
  | 'business';

export const CONTEXT_TYPES: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
  'technical',
  'business',
];

export interface SectionMeta {
  title: string;
  startLine: number;
  endLine: number;
  tokenEstimate: number;
}

export interface CompiledFileMeta {
  type: ContextType;
  title: string;
  lastCompiled: string;
  sourceCount: number;
  sections: SectionMeta[];
  totalTokenEstimate: number;
}

export interface CorpusTypeEntry {
  type: ContextType;
  exists: boolean;
  meta: CompiledFileMeta | null;
  sourceCount: number;
}

export interface CorpusResponse {
  contextRoot: string;
  types: CorpusTypeEntry[];
  totalTokenEstimate: number;
}

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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/corpus');
      if (!res.ok) throw new Error(`Failed to fetch corpus: ${res.status}`);
      const json: CorpusResponse = await res.json();
      setData(json);
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
        })),
        totalTokenEstimate: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchData().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
