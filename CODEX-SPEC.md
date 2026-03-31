# Codex Task: Context Manager Infrastructure Rebuild

## Overview

Rebuild the context manager's data layer: shared types, Vite middleware, and API client
functions. The UI layer (App.tsx, components/, hooks/) is being built separately and will
NOT be part of this task. Both sides program against a shared type contract.

The context manager is moving from a 6-step wizard with a handoff.json export to a
**single-dashboard corpus manager**. The organizational corpus has 7 context types.
Each type has a `compiled.md` (dense, structured markdown with YAML frontmatter) and a
`_sources/` directory of raw inputs. There is no handoff file -- the filesystem IS the
context that agents read.

## Files You Own (modify these)

1. `packages/shared/src/index.ts` -- add new types, update ContextType
2. `packages/context-manager/server/middleware.ts` -- full rewrite
3. `packages/context-manager/src/types.ts` -- full rewrite (thin re-export from shared)
4. `packages/context-manager/src/api/corpus.ts` -- new file
5. `packages/context-manager/src/api/sources.ts` -- new file
6. `packages/context-manager/src/api/compiled.ts` -- new file
7. `packages/context-manager/src/api/import.ts` -- new file

## Files to Delete

- `packages/context-manager/src/api/handoff.ts`
- `packages/context-manager/src/api/localFiles.ts`
- `packages/context-manager/src/api/repository.ts`
- `packages/context-manager/src/api/tools.ts`

## Files You Must NOT Touch

- `packages/context-manager/src/App.tsx`
- `packages/context-manager/src/main.tsx`
- `packages/context-manager/src/styles.css`
- `packages/context-manager/src/components/*` (all component files)
- `packages/context-manager/src/hooks/*` (all hook files)
- `packages/context-manager/vite.config.ts`
- `packages/context-manager/index.html`
- `packages/react/*` (the annotation overlay package)
- `packages/server/*` (the context server package)

---

## Task 1: Update ContextType in @contextual/shared

In `packages/shared/src/index.ts`, update the ContextType union and related constants:

```typescript
/** The seven local context repository types */
export type ContextType =
  | 'research'
  | 'taste'
  | 'strategy'
  | 'design-system'
  | 'stakeholders'
  | 'technical'
  | 'business';

/** All valid local context types */
export const CONTEXT_TYPES: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
  'technical',
  'business',
];

export const DEFAULT_CONTEXT_FOLDERS: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
  'technical',
  'business',
];
```

Also update the `isContextType` function comment to say "7 local context types" and ensure
the function still works (it checks against CONTEXT_TYPES, so it should automatically).

---

## Task 2: Add Corpus Types to @contextual/shared

Add these types to `packages/shared/src/index.ts` in a new section after the existing types.
Place them before the legacy/deprecated sections. Add a clear section header comment.

```typescript
// -----------------------------------------------------------------------------
// Corpus Types (Context Manager)
// -----------------------------------------------------------------------------
// Types for the organizational context corpus. Each ContextType has a compiled
// markdown file with YAML frontmatter and a _sources/ directory of raw inputs.
// -----------------------------------------------------------------------------

/** Metadata for a single section within a compiled context file */
export interface SectionMeta {
  /** Section title (matches the ## heading in the markdown) */
  title: string;
  /** Line number where this section starts (1-indexed) */
  startLine: number;
  /** Line number where this section ends (inclusive) */
  endLine: number;
  /** Approximate token count for this section (word count * 1.3) */
  tokenEstimate: number;
}

/** Frontmatter metadata for a compiled.md file */
export interface CompiledFileMeta {
  /** The context type this file belongs to */
  type: ContextType;
  /** Human-readable title (e.g., "Research Context") */
  title: string;
  /** ISO timestamp of last compilation */
  lastCompiled: string;
  /** Number of raw source files that were compiled */
  sourceCount: number;
  /** Section-level table of contents */
  sections: SectionMeta[];
  /** Total approximate token count across all sections */
  totalTokenEstimate: number;
}

/** Summary of one context type in the corpus */
export interface CorpusTypeEntry {
  /** The context type */
  type: ContextType;
  /** Whether a compiled.md exists for this type */
  exists: boolean;
  /** Parsed frontmatter from compiled.md (null if file doesn't exist) */
  meta: CompiledFileMeta | null;
  /** Number of files in _sources/ */
  sourceCount: number;
}

/** Response for GET /api/corpus */
export interface CorpusResponse {
  /** Path to the context root directory */
  contextRoot: string;
  /** Status for each of the 7 context types */
  types: CorpusTypeEntry[];
  /** Sum of all token estimates across all types */
  totalTokenEstimate: number;
}

/** Response for GET /api/corpus/:type */
export interface CompiledFileResponse {
  /** Parsed frontmatter */
  meta: CompiledFileMeta;
  /** Full markdown body (everything after the frontmatter) */
  content: string;
}

/** Response for GET /api/corpus/:type/sections/:index */
export interface SectionResponse {
  /** The section metadata */
  section: SectionMeta;
  /** The section content (markdown text) */
  content: string;
}

/** A raw source file in _sources/ */
export interface SourceFile {
  /** Filename (e.g., "article-1.md") */
  filename: string;
  /** File size in bytes */
  size: number;
  /** Content preview (first 400 characters) */
  preview: string;
  /** ISO timestamp when the file was added (from filename or file stat) */
  addedAt: string;
}

/** Response for GET /api/corpus/:type/sources */
export interface SourceListResponse {
  /** The context type */
  type: ContextType;
  /** List of raw source files */
  sources: SourceFile[];
}

/** Response for GET /api/corpus/:type/sources/:filename */
export interface SourceContentResponse {
  /** The filename */
  filename: string;
  /** Full file content */
  content: string;
}

/** Request body for POST /api/corpus/:type/sources */
export interface AddSourceRequest {
  /** Filename (auto-generated as paste-{timestamp}.md if omitted) */
  filename?: string;
  /** The content to write */
  content: string;
  /** Optional label (written as a comment at the top of the file) */
  label?: string;
}

/** Response for POST /api/corpus/:type/sources */
export interface AddSourceResponse {
  /** The final filename used */
  filename: string;
  /** Full path to the written file */
  path: string;
}

/** Request body for PUT /api/corpus/:type/compiled */
export interface UpdateCompiledRequest {
  /** Full markdown content including YAML frontmatter */
  content: string;
}

/** Request body for POST /api/corpus/import */
export interface ImportRequest {
  /** Path to the source context root to import from */
  sourcePath: string;
  /** Which context types to import */
  types: ContextType[];
}

/** Response for POST /api/corpus/import */
export interface ImportResponse {
  /** What was imported, grouped by type */
  imported: Array<{
    type: ContextType;
    files: string[];
  }>;
}
```

---

## Task 3: Rewrite server/middleware.ts

Completely rewrite `packages/context-manager/server/middleware.ts`. Replace all existing
endpoints with the new corpus-centric API.

### Directory Structure on Disk

The middleware reads/writes this structure under `contextRoot`:

```
<contextRoot>/
  research/
    compiled.md          <-- compiled markdown with YAML frontmatter
    _sources/            <-- raw source files
      article-1.md
      paste-1698234567.md
  taste/
    compiled.md
    _sources/
  strategy/
    compiled.md
    _sources/
  design-system/
    compiled.md
    _sources/
  stakeholders/
    compiled.md
    _sources/
  technical/
    compiled.md
    _sources/
  business/
    compiled.md
    _sources/
```

### Runtime Configuration

Same pattern as current: read from URL query params first, then env vars:
- `contextRoot` -- URL param `contextRoot` or env `CONTEXTUAL_CONTEXT_ROOT` or default `./context`
- No more `projectPath` or `previousProjectsPath` -- those concepts are removed.

### Frontmatter Parsing

Compiled.md files have YAML frontmatter between `---` delimiters. Parse it with simple
string splitting -- do NOT add a YAML library dependency. The frontmatter structure is:

```yaml
---
type: research
title: Research Context
lastCompiled: 2026-03-30T12:00:00Z
sourceCount: 12
sections:
  - title: "User Research Findings"
    startLine: 8
    endLine: 45
    tokenEstimate: 850
  - title: "Competitive Analysis"
    startLine: 47
    endLine: 112
    tokenEstimate: 1400
totalTokenEstimate: 2250
---
```

Write a `parseFrontmatter(content: string): CompiledFileMeta | null` function that:
1. Splits on `---` to extract the YAML block
2. Parses key-value pairs with regex (handles strings, numbers, arrays of objects)
3. Returns null if the file has no valid frontmatter

Also write a helper `estimateTokens(text: string): number` that returns
`Math.ceil(text.split(/\s+/).length * 1.3)`.

### Endpoints to Implement

Keep the Vite plugin export pattern:
```typescript
export function localFilesPlugin(): Plugin { ... }
```

#### GET /api/corpus

Returns `CorpusResponse`. For each of the 7 context types:
1. Check if `<contextRoot>/<type>/compiled.md` exists
2. If yes, parse its frontmatter to get `CompiledFileMeta`
3. Count files in `<contextRoot>/<type>/_sources/` (create dir if it doesn't exist)
4. Return the entry

#### GET /api/corpus/:type

Returns `CompiledFileResponse`. Read `<contextRoot>/<type>/compiled.md`, parse frontmatter
into `meta`, return the body (everything after the second `---`) as `content`.
Return 404 `{ error: "No compiled file for type 'research'" }` if file doesn't exist.

#### GET /api/corpus/:type/sections/:index

Returns `SectionResponse`. Read the compiled file, use the `sections` array from
frontmatter to extract lines `startLine` through `endLine` from the body.
Return 404 if section index is out of range.

#### GET /api/corpus/:type/sources

Returns `SourceListResponse`. List all files in `<contextRoot>/<type>/_sources/`.
For each file: read filename, stat for size, read first 400 chars as preview,
use file mtime as `addedAt`.

#### GET /api/corpus/:type/sources/:filename

Returns `SourceContentResponse`. Read the full content of the specified source file.
Return 404 if file doesn't exist.

#### POST /api/corpus/:type/sources

Accepts `AddSourceRequest`, returns `AddSourceResponse`.
1. If `filename` is not provided, generate one: `paste-{Date.now()}.md`
2. If `label` is provided, prepend `<!-- label: {label} -->\n\n` to the content
3. Write the file to `<contextRoot>/<type>/_sources/<filename>`
4. Create the `_sources/` directory if it doesn't exist (and the type directory)
5. Return the filename and full path

#### DELETE /api/corpus/:type/sources/:filename

Delete the source file. Return `{ ok: true }`. Return 404 if file doesn't exist.

#### PUT /api/corpus/:type/compiled

Accepts `UpdateCompiledRequest`, returns `{ ok: true }`.
1. Create the type directory if it doesn't exist
2. Write the content to `<contextRoot>/<type>/compiled.md`
3. Write to a temp file first, then rename (atomic write)

#### POST /api/corpus/import

Accepts `ImportRequest`, returns `ImportResponse`.
1. For each type in `request.types`:
   - Check if `<sourcePath>/<type>/` exists
   - Copy all files from `<sourcePath>/<type>/_sources/` to `<contextRoot>/<type>/_sources/`
   - Also copy `<sourcePath>/<type>/compiled.md` if it exists
2. Create directories as needed
3. Return list of copied files per type

### Error Handling

- All errors return JSON: `{ error: "descriptive message" }`
- Use status codes: 200 (ok), 201 (created), 400 (bad request), 404 (not found), 500 (server error)
- Validate that `:type` param is a valid ContextType using the `isContextType` guard
- If `:type` is invalid, return 400: `{ error: "Invalid context type: 'foo'" }`

### Helper Functions to Keep/Adapt

From the existing middleware, keep these patterns:
- `sendJson(res, statusCode, payload)` -- sends JSON response
- `readJson(req)` -- parses request body as JSON
- `exists(filePath)` -- async file existence check
- `listFilesRecursively(directory)` -- or simplify to a non-recursive listing for `_sources/`

---

## Task 4: Rewrite src/types.ts

Replace the entire content of `packages/context-manager/src/types.ts` with a thin
re-export from shared:

```typescript
// =============================================================================
// Context Manager Types
// =============================================================================
// Re-exports all context-manager-relevant types from @contextual/shared.
// The UI layer imports from this file, never directly from shared.
// =============================================================================

export type {
  ContextType,
  CompiledFileMeta,
  CompiledFileResponse,
  CorpusResponse,
  CorpusTypeEntry,
  SectionMeta,
  SectionResponse,
  SourceFile,
  SourceListResponse,
  SourceContentResponse,
  AddSourceRequest,
  AddSourceResponse,
  UpdateCompiledRequest,
  ImportRequest,
  ImportResponse,
} from '@contextual/shared';

export { CONTEXT_TYPES } from '@contextual/shared';
```

---

## Task 5: Rewrite src/api/ Files

Delete the old files: `handoff.ts`, `localFiles.ts`, `repository.ts`, `tools.ts`.

Create these new files:

### src/api/corpus.ts

```typescript
import type { CorpusResponse, CompiledFileResponse, SectionResponse } from '../types.js';

/** Fetch the full corpus overview (all 7 types with metadata) */
export async function fetchCorpus(): Promise<CorpusResponse> {
  const res = await fetch('/api/corpus');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Fetch the compiled file for a specific context type */
export async function fetchCompiledFile(type: string): Promise<CompiledFileResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Fetch a specific section from a compiled file */
export async function fetchSection(type: string, index: number): Promise<SectionResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sections/${index}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### src/api/sources.ts

```typescript
import type {
  SourceListResponse,
  SourceContentResponse,
  AddSourceRequest,
  AddSourceResponse,
} from '../types.js';

/** List all raw sources for a context type */
export async function fetchSources(type: string): Promise<SourceListResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sources`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Read full content of a single source file */
export async function fetchSource(type: string, filename: string): Promise<SourceContentResponse> {
  const res = await fetch(
    `/api/corpus/${encodeURIComponent(type)}/sources/${encodeURIComponent(filename)}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Add a new raw source file (paste or upload) */
export async function addSource(type: string, req: AddSourceRequest): Promise<AddSourceResponse> {
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Delete a raw source file */
export async function deleteSource(type: string, filename: string): Promise<void> {
  const res = await fetch(
    `/api/corpus/${encodeURIComponent(type)}/sources/${encodeURIComponent(filename)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(await res.text());
}
```

### src/api/compiled.ts

```typescript
import type { UpdateCompiledRequest } from '../types.js';

/** Write or update the compiled markdown for a context type */
export async function updateCompiled(type: string, content: string): Promise<void> {
  const req: UpdateCompiledRequest = { content };
  const res = await fetch(`/api/corpus/${encodeURIComponent(type)}/compiled`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(await res.text());
}
```

### src/api/import.ts

```typescript
import type { ImportRequest, ImportResponse, ContextType } from '../types.js';

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
  return res.json();
}
```

---

## Constraints

- **No new npm dependencies.** Use Node built-in `fs`, `path`, `crypto` only.
- **Keep the Vite plugin export pattern** (`export function localFilesPlugin(): Plugin`).
- **Atomic file writes** where possible (write to `.tmp`, then `fs.rename`).
- **Auto-create directories** on write operations (use `fs.mkdir` with `recursive: true`).
- **Token estimation**: `Math.ceil(text.split(/\s+/).length * 1.3)`.
- **All error responses** are JSON: `{ error: "message" }`.
- **File type filtering**: only read `.md`, `.txt`, `.json` files from `_sources/`.
- **TypeScript strict mode**: the project uses `strict: true` in tsconfig.

## Build & Verify

After making changes:
```bash
cd /path/to/contextual
npm run build --workspace=@contextual/shared
npm run build --workspace=@contextual/context-manager
```

Both should compile without errors. The middleware must export `localFilesPlugin` as a
named export for `vite.config.ts` to import.
