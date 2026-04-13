import type { UpdateCompiledRequest } from '../types.js';
import { apiFetch } from './client.js';

/** Write or update the compiled markdown for a context type */
export async function updateCompiled(type: string, content: string): Promise<void> {
  const req: UpdateCompiledRequest = { content };
  const res = await apiFetch(`/api/corpus/${encodeURIComponent(type)}/compiled`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
}
