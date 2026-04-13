import type { ConfiguredTool } from '../types.js';
import { apiFetch } from './client.js';

export async function fetchTools(): Promise<ConfiguredTool[]> {
  const response = await apiFetch('/tools');
  if (!response.ok) {
    throw new Error('Failed to load tools from server');
  }
  const data = (await response.json()) as { tools: ConfiguredTool[] };
  return data.tools;
}

export async function saveTools(tools: ConfiguredTool[]): Promise<ConfiguredTool[]> {
  const response = await apiFetch('/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tools }),
  });

  if (!response.ok) {
    throw new Error('Failed to save tools');
  }
  const data = (await response.json()) as { tools: ConfiguredTool[] };
  return data.tools;
}
