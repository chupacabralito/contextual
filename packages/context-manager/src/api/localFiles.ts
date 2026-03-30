import type { ContextRootResponse, PreviousProjectsResponse } from '../types.js';

export async function fetchContextRoot(): Promise<ContextRootResponse> {
  const response = await fetch('/api/context-root');
  if (!response.ok) {
    throw new Error('Failed to load context root');
  }
  return response.json() as Promise<ContextRootResponse>;
}

export async function fetchPreviousProjects(): Promise<PreviousProjectsResponse> {
  const response = await fetch('/api/previous-projects');
  if (!response.ok) {
    throw new Error('Failed to load previous projects');
  }
  return response.json() as Promise<PreviousProjectsResponse>;
}
