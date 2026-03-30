import type { ConfiguredTool } from '../types.js';

const SERVER_URL = 'http://localhost:4700';

export async function fetchTools(): Promise<ConfiguredTool[]> {
  const response = await fetch(`${SERVER_URL}/tools`);
  if (!response.ok) {
    throw new Error('Failed to load tools from server');
  }
  const data = (await response.json()) as { tools: ConfiguredTool[] };
  return data.tools;
}

export async function saveTools(tools: ConfiguredTool[]): Promise<ConfiguredTool[]> {
  const response = await fetch(`${SERVER_URL}/tools`, {
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
