# Pass Handoff: Server Implementation

## Pass Name

Server Core Implementation

## Goal

Implement the local context server that indexes markdown/JSON files in context folders, provides autocomplete suggestions and search for the annotation component and context manager, and serves results over local HTTP. The server does NOT resolve @mentions for the agent -- the agent handles resolution directly. The server's role is indexing, search, autocomplete, and project scaffolding.

## Owner

Codex

## Owned Files

- `packages/server/src/**/*`

## Off-Limits Files

- `packages/shared/**/*`
- `packages/react/**/*`
- `package.json` (root)
- `tsconfig.base.json`
- `docs/**/*`

## Required Inputs

- **Shared types/API contract:** `packages/shared/src/index.ts` defines all request/response types. Implement endpoints to match these types exactly.
- **Stub files:** Each file in `packages/server/src/` has a stub with TODO comments describing what to build.
- **Dependencies:** All dependencies are already installed in `packages/server/package.json`:
  - `sql.js` ^1.11.0 -- Pure JS SQLite (FTS5 support, no native compilation)
  - `chokidar` ^4.0.0 -- File watching
  - `express` ^5.0.0 -- HTTP server
  - `cors` ^2.8.5 -- CORS middleware
  - `gray-matter` ^4.0.3 -- Markdown frontmatter parsing

### API Contract Summary

**POST /resolve** -- Search endpoint. Receives `ResolveRequest` (mentions array + depth level), returns `ResolveResponse` (ranked matches per mention from local indexed files). Note: this is used for autocomplete previews and local context search, NOT for agent-side @mention resolution. The agent reads context files directly or uses its own tools.

**GET /health** -- Returns `HealthResponse` (status, indexed file count, project name, available context types).

**GET /suggest** -- Query params: `partial` (string), `type` (optional). Returns `SuggestResponse` (autocomplete suggestions for @mention types and content within local context folders).

**POST /scaffold** -- Receives `ScaffoldRequest` (project name + base path), creates folder structure with five subdirectories (research, taste, strategy, design-system, stakeholders), returns `ScaffoldResponse`.

### Files to implement (in priority order)

1. **`indexer/ContextIndex.ts`** -- SQLite FTS5 indexer. Scan context folders recursively, parse markdown with gray-matter, build FTS5 virtual table (columns: content, source, date, contextType). Watch files with chokidar. Expose `search()`, `suggest()`, `getStats()` methods. BM25 ranking for relevance.

2. **`resolver/depthController.ts`** -- Filter matches by depth. Light: truncate to ~120 chars, top 1. Standard: full content + source + date, top 3. Detailed: full + relatedFindings, top 5. Full: everything, no limits. For detailed/full, run secondary search within same context type to populate `relatedFindings`.

3. **`server.ts`** -- Express server. CORS allow all origins (local tool). Wire up all 4 endpoints. Validate request bodies (400 for bad requests). JSON responses matching shared types. Console logging.

4. **`scaffold.ts`** -- Create `basePath/projectName` with 5 subdirectories (research, taste, strategy, design-system, stakeholders). README.md in each with one-line guidance. Handle errors (exists, permissions, invalid path). Use Node fs/promises.

5. **`cli.ts`** -- Start server listening. Print "Contextual server running on http://localhost:{port}" and indexed file count. SIGINT/SIGTERM graceful shutdown. Exit with error if contextRoot doesn't exist.

## Completion Signal

- `npm run build --workspace=@contextual/server` passes with zero errors
- Server starts with `node packages/server/dist/cli.js --context-root ./test-project`
- `GET /health` returns `{ status: "ok", indexedFiles: <N>, ... }`
- `POST /resolve` with a mention query returns ranked matches from indexed markdown files
- `GET /suggest?partial=user` returns autocomplete suggestions
- `POST /scaffold` creates folder structure on disk

## Assumptions

- Context folders contain markdown (.md) and JSON (.json) files only
- Markdown files may have YAML frontmatter with a `date` field (parsed via gray-matter)
- Context type is determined by the parent folder name (e.g., files under `/research/` are type `research`)
- The server runs on localhost only -- no auth, no TLS, no remote access
- `sql.js` supports FTS5 out of the box (it does -- WASM build includes it)
- Default port is 4700 (defined as `DEFAULT_SERVER_PORT` in shared types)

## Architecture Context

The server is one of three components in the Contextual MVP:

1. **Context manager** (standalone React app) -- browser-based UI for context setup before the first prototype, invoked via `/use-contextual`
2. **React annotation component** (npm package) -- renders alongside the prototype for refinement passes with @mention agent actions
3. **Local context server** (this component) -- indexes context folders, provides autocomplete and search for both UIs

The server does NOT resolve @mentions for the agent. @mentions are agent actions -- the agent handles resolution using whatever tools it has access to (local files, MCP servers, APIs). The server's autocomplete and search endpoints help designers see what local context exists and get suggestions while typing @mentions.

## Open Questions

- Should the FTS5 index be persisted to disk or rebuilt on every startup? Recommendation: rebuild on startup for simplicity in MVP. Persistence is an optimization for later.
- Should `GET /suggest` search file names, content, or both? Recommendation: both, with file name matches ranked higher.

## Notes For Next Pass

- The React annotation component (`packages/react/`) calls `POST /resolve` and `GET /suggest` for autocomplete. Once the server is running, the two packages should work together without changes.
- The React component handles server-down gracefully -- shows error message but still allows annotation without resolved context previews.
- After this pass, the next step is integration testing: running server + React component together with real context files.
- The context manager (standalone React app) is a separate future build pass.
