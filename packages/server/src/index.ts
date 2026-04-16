// =============================================================================
// @contextualapp/server - Local Context Server
// =============================================================================
// Node process that indexes context folders (markdown/JSON), resolves @mention
// queries via SQLite FTS5 search, and serves results over local HTTP.
// =============================================================================

export { createServer } from './server.js';
export { ContextIndex } from './indexer/ContextIndex.js';
export { PassStore } from './passes/PassStore.js';
export { OutcomeStore } from './outcomes/OutcomeStore.js';
export { resolveByDepth } from './resolver/depthController.js';
export { ensureFlywheelArtifacts, scaffold } from './scaffold.js';
export { resolveContextRoot, readProjectConfig, writeProjectConfig } from './config.js';
export type { ProjectConfig } from './config.js';

// Re-export shared types
export type {
  CreateOutcomeRequest,
  CreateOutcomeResponse,
  ServerConfig,
  OutcomeListResponse,
  PassOutcome,
  ResolveRequest,
  ResolveResponse,
  HealthResponse,
  SuggestRequest,
  SuggestResponse,
  ScaffoldRequest,
  ScaffoldResponse,
} from '@contextualapp/shared';

export { DEFAULT_SERVER_PORT } from '@contextualapp/shared';
