// =============================================================================
// useInitiatives / useProjects Hooks
// =============================================================================
// Fetches the initiative list and supports creating new initiatives. Used by
// the CorpusTree sidebar for inline create + selection.
//
// The legacy `useProjects` hook hits `/api/projects` and is kept for one
// minor cycle for any external consumers; new code should use `useInitiatives`.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';
import type {
  InitiativeSummary,
  InitiativeListResponse,
  CreateInitiativeRequest,
  ProjectSummary,
  ProjectListResponse,
  CreateProjectRequest,
} from '@contextualapp/shared';

// Re-export Initiative types (new)
export type { InitiativeSummary, InitiativeListResponse, CreateInitiativeRequest } from '@contextualapp/shared';

// Re-export so existing imports across context-manager stay stable
export type { ProjectSummary, ProjectListResponse, CreateProjectRequest } from '@contextualapp/shared';

// ---------------------------------------------------------------------------
// useInitiatives Hook (new)
// ---------------------------------------------------------------------------

interface UseInitiativesReturn {
  initiatives: InitiativeSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createInitiative: (request: CreateInitiativeRequest) => Promise<void>;
}

export function useInitiatives(): UseInitiativesReturn {
  const [initiatives, setInitiatives] = useState<InitiativeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/initiatives');
      if (!res.ok) throw new Error(`Failed to fetch initiatives: ${res.status}`);
      const json = await res.json() as InitiativeListResponse;
      setInitiatives(json.initiatives);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load initiatives';
      setError(message);
      setInitiatives([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchData().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [fetchData]);

  const createInitiative = useCallback(async (request: CreateInitiativeRequest) => {
    const res = await apiFetch('/api/initiatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || `Failed to create initiative: ${res.status}`);
    }
    await fetchData();
  }, [fetchData]);

  return { initiatives, isLoading, error, refetch: fetchData, createInitiative };
}

// ---------------------------------------------------------------------------
// useProjects Hook (legacy - deprecated)
// ---------------------------------------------------------------------------

interface UseProjectsReturn {
  projects: ProjectSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createProject: (request: CreateProjectRequest) => Promise<void>;
}

/** @deprecated Use useInitiatives */
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
