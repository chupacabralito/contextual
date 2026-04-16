// =============================================================================
// useProjects Hook
// =============================================================================
// Fetches the project list and supports creating new projects. Used by the
// ProjectPicker component for "pick up recent or start new" flow.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';
import type {
  ProjectSummary,
  ProjectListResponse,
  CreateProjectRequest,
} from '@contextualapp/shared';

// Re-export so existing imports across context-manager stay stable
export type { ProjectSummary, ProjectListResponse, CreateProjectRequest } from '@contextualapp/shared';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseProjectsReturn {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createProject: (request: CreateProjectRequest) => Promise<void>;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/projects');
      if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
      const json = await res.json() as ProjectListResponse;
      setProjects(json.projects);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchData().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [fetchData]);

  const createProject = useCallback(async (request: CreateProjectRequest) => {
    const res = await apiFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || `Failed to create project: ${res.status}`);
    }
    await fetchData();
  }, [fetchData]);

  return { projects, isLoading, error, refetch: fetchData, createProject };
}
