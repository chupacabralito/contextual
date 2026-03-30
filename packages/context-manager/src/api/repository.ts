import type { RepositoryResponse } from '../types.js';

export async function fetchRepository(): Promise<RepositoryResponse> {
  const response = await fetch('/api/repository');
  if (!response.ok) {
    throw new Error('Failed to load repository');
  }
  return response.json() as Promise<RepositoryResponse>;
}
