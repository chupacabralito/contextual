// =============================================================================
// @contextual/server - Local Context Server
// =============================================================================
// Node process that indexes context folders (markdown/JSON), resolves @mention
// queries via SQLite FTS5 search, and serves results over local HTTP.
// =============================================================================

export { createServer } from './server.js';
export { ContextIndex } from './indexer/ContextIndex.js';
export { resolveByDepth } from './resolver/depthController.js';
export { scaffold } from './scaffold.js';

// Re-export shared types
export type {
  ServerConfig,
  ResolveRequest,
  ResolveResponse,
  HealthResponse,
  SuggestRequest,
  SuggestResponse,
  ScaffoldRequest,
  ScaffoldResponse,
} from '@contextual/shared';

export { DEFAULT_SERVER_PORT } from '@contextual/shared';
