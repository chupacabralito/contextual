import type {
  CompiledFileResponse,
  CorpusResponse,
  SectionResponse,
} from '../types.js';

/** Fetch the full corpus overview (all 7 types with metadata) */
export async function fetchCorpus(): Promise<CorpusResponse> {
  const res = await fetch('/api/corpus');
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CorpusResponse>;
}

/** Fetch the compiled file for a specific context type */
export async function fetchCompiledFile(type: string): Promise<CompiledFileResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<CompiledFileResponse>;
}

/** Fetch a specific section from a compiled file */
export async function fetchSection(type: string, index: number): Promise<SectionResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sections/${index}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<SectionResponse>;
}
