import type {
  AddSourceRequest,
  AddSourceResponse,
  SourceContentResponse,
  SourceListResponse,
} from '../types.js';

/** List all raw sources for a context type */
export async function fetchSources(type: string): Promise<SourceListResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sources`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SourceListResponse>;
}

/** Read full content of a single source file */
export async function fetchSource(
  type: string,
  filename: string
): Promise<SourceContentResponse> {
  const res = await fetch(
    `/api/corpus/${encodeURIComponent(type)}/sources/${encodeURIComponent(filename)}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SourceContentResponse>;
}

/** Add a new raw source file (paste or upload) */
export async function addSource(
  type: string,
  req: AddSourceRequest
): Promise<AddSourceResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AddSourceResponse>;
}

/** Delete a raw source file */
export async function deleteSource(type: string, filename: string): Promise<void> {
  const res = await fetch(
    `/api/corpus/${encodeURIComponent(type)}/sources/${encodeURIComponent(filename)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(await res.text());
}
