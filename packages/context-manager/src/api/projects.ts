import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectDetailResponse,
  ProjectListResponse,
} from '@contextual/shared';
import { apiFetch } from './client.js';

export async function fetchProjects(): Promise<ProjectListResponse> {
  const res = await apiFetch('/api/projects');
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json() as Promise<ProjectListResponse>;
}

export async function fetchProject(name: string): Promise<ProjectDetailResponse> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.status}`);
  return res.json() as Promise<ProjectDetailResponse>;
}

export async function createProject(
  request: CreateProjectRequest
): Promise<CreateProjectResponse> {
  const res = await apiFetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `Failed to create project: ${res.status}`
    );
  }
  return res.json() as Promise<CreateProjectResponse>;
}

export async function updatePriority(
  type: string,
  priority: 'system' | 'project' | 'reference'
): Promise<void> {
  const res = await apiFetch(`/api/corpus/${encodeURIComponent(type)}/priority`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priority }),
  });
  if (!res.ok) throw new Error(`Failed to update priority: ${res.status}`);
}
