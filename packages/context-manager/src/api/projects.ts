import type {
  CreateInitiativeRequest,
  CreateInitiativeResponse,
  InitiativeDetailResponse,
  InitiativeListResponse,
} from '@contextualapp/shared';
import { apiFetch } from './client.js';

export async function fetchInitiatives(): Promise<InitiativeListResponse> {
  const res = await apiFetch('/api/initiatives');
  if (!res.ok) throw new Error(`Failed to fetch initiatives: ${res.status}`);
  return res.json() as Promise<InitiativeListResponse>;
}

export async function fetchInitiative(name: string): Promise<InitiativeDetailResponse> {
  const res = await apiFetch(`/api/initiatives/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to fetch initiative: ${res.status}`);
  return res.json() as Promise<InitiativeDetailResponse>;
}

export async function createInitiative(
  request: CreateInitiativeRequest
): Promise<CreateInitiativeResponse> {
  const res = await apiFetch('/api/initiatives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `Failed to create initiative: ${res.status}`
    );
  }
  return res.json() as Promise<CreateInitiativeResponse>;
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
