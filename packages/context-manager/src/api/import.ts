import type { ContextType, ImportRequest, ImportResponse } from '../types.js';

/** Bulk import sources from another context root */
export async function importFromProject(
  sourcePath: string,
  types: ContextType[]
): Promise<ImportResponse> {
  const req: ImportRequest = { sourcePath, types };
  const res = await fetch('/api/corpus/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ImportResponse>;
}
