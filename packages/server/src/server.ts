// =============================================================================
// Context Server
// =============================================================================
// Express server that handles @mention resolution requests from the
// React annotation component. Runs locally on the designer's machine.
// =============================================================================

import type { AddressInfo } from 'node:net';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import type {
  ContextType,
  CreatePassRequest,
  CreatePassResponse,
  HealthResponse,
  InspectResponse,
  Pass,
  PassListResponse,
  ResolveRequest,
  ResolveResponse,
  ScaffoldRequest,
  ScaffoldResponse,
  ServerConfig,
  SuggestResponse,
  ToolsResponse,
  UpdateToolsRequest,
} from '@contextual/shared';
import {
  CONTEXT_TYPES,
  DEFAULT_SERVER_PORT,
  isContextType,
} from '@contextual/shared';
import { ContextIndex } from './indexer/ContextIndex.js';
import { resolveByDepth } from './resolver/depthController.js';
import { scaffold } from './scaffold.js';
import { PassStore } from './passes/PassStore.js';
import { ToolStore } from './tools/ToolStore.js';

interface ServerErrorResponse {
  error: string;
}

export interface ContextualServer {
  app: express.Express;
  config: ServerConfig;
  index: ContextIndex;
  ready: Promise<void>;
  start: () => Promise<http.Server>;
  stop: () => Promise<void>;
}

function isResolveRequest(value: unknown): value is ResolveRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as ResolveRequest;
  return (
    Array.isArray(request.mentions) &&
    typeof request.depth === 'string' &&
    request.mentions.every(
      (mention) =>
        mention &&
        typeof mention === 'object' &&
        typeof mention.type === 'string' &&
        typeof mention.query === 'string'
    )
  );
}

function isScaffoldRequest(value: unknown): value is ScaffoldRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as ScaffoldRequest;
  return (
    typeof request.projectName === 'string' &&
    typeof request.basePath === 'string'
  );
}

function parseSuggestType(value: unknown): ContextType | undefined {
  if (typeof value !== 'string') return undefined;
  return isContextType(value) ? value as ContextType : undefined;
}

/**
 * Create and configure the context server.
 */
export function createServer(configInput: Partial<ServerConfig> = {}): ContextualServer {
  const config: ServerConfig = {
    port: configInput.port ?? DEFAULT_SERVER_PORT,
    contextRoot: configInput.contextRoot ?? process.cwd(),
    projectName: configInput.projectName ?? 'default',
  };

  const app = express();
  const index = new ContextIndex(config.contextRoot);
  const passStore = new PassStore(config.contextRoot);
  const toolStore = new ToolStore(config.contextRoot);
  const ready = Promise.all([index.ready(), passStore.initialize(), toolStore.initialize()]).then(() => {});
  let httpServer: http.Server | null = null;

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use((req, _res, next) => {
    console.log(`[contextual-server] ${req.method} ${req.path}`);
    next();
  });

  app.get('/health', async (_req, res: express.Response<HealthResponse | ServerErrorResponse>) => {
    try {
      const stats = await index.getStats();
      res.json({
        status: 'ok',
        indexedFiles: stats.indexedFiles,
        project: config.projectName,
        availableTypes: stats.availableTypes,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({ error: 'Failed to read health status' });
    }
  });

  app.get('/suggest', async (req, res: express.Response<SuggestResponse | ServerErrorResponse>) => {
    const partial = req.query.partial;
    if (typeof partial !== 'string' || !partial.trim()) {
      res.status(400).json({ error: 'Query parameter "partial" is required' });
      return;
    }

    // If type is a known ContextType, filter to that type.
    // If type is provided but not a ContextType, we still accept it
    // (it may be a configured tool name) but skip local index search.
    const typeParam = typeof req.query.type === 'string' ? req.query.type : undefined;
    const localType = typeParam ? parseSuggestType(typeParam) : undefined;

    try {
      // Search local context index for known types (or all types if no filter)
      const localSuggestions = (!typeParam || localType)
        ? await index.suggest(partial, localType)
        : [];

      // Also include configured tools that match the partial
      const normalizedPartial = partial.trim().toLowerCase();
      const enabledTools = toolStore.getEnabledTools();
      const toolSuggestions = enabledTools
        .filter((tool) =>
          tool.name.toLowerCase().startsWith(normalizedPartial) ||
          tool.label.toLowerCase().includes(normalizedPartial)
        )
        .map((tool) => ({
          text: tool.name,
          type: tool.name,
          preview: tool.label,
        }));

      // Merge: local suggestions first, then tool suggestions (deduplicated)
      const seen = new Set(localSuggestions.map((s) => s.text));
      const merged = [
        ...localSuggestions,
        ...toolSuggestions.filter((s) => !seen.has(s.text)),
      ];

      res.json({ suggestions: merged });
    } catch (error) {
      console.error('Suggest failed:', error);
      res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  });

  app.post('/resolve', async (req, res: express.Response<ResolveResponse | ServerErrorResponse>) => {
    if (!isResolveRequest(req.body)) {
      res.status(400).json({ error: 'Request body must match ResolveRequest' });
      return;
    }

    try {
      const results = await Promise.all(
        req.body.mentions.map(async (mention) => {
          // Only search local context for known ContextType values.
          // Unknown sources (e.g., "posthog", "figma") pass through with
          // empty matches -- the agent resolves them at runtime.
          if (!isContextType(mention.type)) {
            return {
              type: mention.type,
              query: mention.query,
              matches: [],
            };
          }

          const contextType = mention.type; // Narrowed to ContextType by guard above
          const matches = await index.search(mention.query, contextType);
          const resolvedMatches = await resolveByDepth(matches, req.body.depth, {
            getRelatedFindings: (match) => index.getRelatedFindings(match, contextType),
          });

          return {
            type: mention.type,
            query: mention.query,
            matches: resolvedMatches,
          };
        })
      );

      res.json({ results });
    } catch (error) {
      console.error('Resolve failed:', error);
      res.status(500).json({ error: 'Failed to resolve mentions' });
    }
  });

  app.post('/scaffold', async (req, res: express.Response<ScaffoldResponse | ServerErrorResponse>) => {
    if (!isScaffoldRequest(req.body)) {
      res.status(400).json({ error: 'Request body must match ScaffoldRequest' });
      return;
    }

    try {
      const result = await scaffold(req.body);
      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to scaffold project';
      res.status(400).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // Pass Endpoints (B4)
  // ---------------------------------------------------------------------------

  app.post('/passes', async (req, res: express.Response<CreatePassResponse | ServerErrorResponse>) => {
    const body = req.body as Partial<CreatePassRequest>;

    if (!body.pass || typeof body.pass !== 'object') {
      res.status(400).json({ error: 'Request body must include a "pass" object' });
      return;
    }

    const pass = body.pass as Partial<Pass>;
    if (
      typeof pass.id !== 'string' ||
      typeof pass.timestamp !== 'string' ||
      typeof pass.depth !== 'string' ||
      !Array.isArray(pass.instructions)
    ) {
      res.status(400).json({ error: 'Pass must include id, timestamp, depth, and instructions[]' });
      return;
    }

    try {
      const filePath = await passStore.createPass(pass as Pass);
      res.status(201).json({
        id: pass.id,
        path: filePath,
        timestamp: pass.timestamp,
      });
    } catch (error) {
      console.error('Create pass failed:', error);
      res.status(500).json({ error: 'Failed to persist pass' });
    }
  });

  app.get('/passes', async (_req, res: express.Response<PassListResponse | ServerErrorResponse>) => {
    try {
      const passes = await passStore.listPassSummaries();
      res.json({ passes });
    } catch (error) {
      console.error('List passes failed:', error);
      res.status(500).json({ error: 'Failed to list passes' });
    }
  });

  app.get('/passes/:id', async (req, res: express.Response<Pass | ServerErrorResponse>) => {
    try {
      const pass = await passStore.getPass(req.params.id);
      if (!pass) {
        res.status(404).json({ error: `Pass not found: ${req.params.id}` });
        return;
      }
      res.json(pass);
    } catch (error) {
      console.error('Get pass failed:', error);
      res.status(500).json({ error: 'Failed to read pass' });
    }
  });

  // ---------------------------------------------------------------------------
  // Inspect Endpoint (B4)
  // ---------------------------------------------------------------------------

  app.get('/inspect', async (req, res: express.Response<InspectResponse | ServerErrorResponse>) => {
    const selector = req.query.selector;
    if (typeof selector !== 'string' || !selector.trim()) {
      res.status(400).json({ error: 'Query parameter "selector" is required' });
      return;
    }

    try {
      const [passes, contextHistory] = await Promise.all([
        passStore.getPassesForElement(selector),
        passStore.getContextHistoryForElement(selector),
      ]);

      res.json({
        selector,
        passes,
        contextHistory,
      });
    } catch (error) {
      console.error('Inspect failed:', error);
      res.status(500).json({ error: 'Failed to inspect element' });
    }
  });

  // ---------------------------------------------------------------------------
  // Tools Endpoints (B9)
  // ---------------------------------------------------------------------------

  app.get('/tools', async (_req, res: express.Response<ToolsResponse | ServerErrorResponse>) => {
    try {
      const tools = toolStore.getTools();
      res.json({ tools });
    } catch (error) {
      console.error('Get tools failed:', error);
      res.status(500).json({ error: 'Failed to read tools' });
    }
  });

  app.post('/tools', async (req, res: express.Response<ToolsResponse | ServerErrorResponse>) => {
    const body = req.body as Partial<UpdateToolsRequest>;

    if (!Array.isArray(body.tools)) {
      res.status(400).json({ error: 'Request body must include a "tools" array' });
      return;
    }

    // Validate each tool in the array
    for (const tool of body.tools) {
      if (
        !tool ||
        typeof tool !== 'object' ||
        typeof tool.name !== 'string' ||
        typeof tool.label !== 'string' ||
        typeof tool.enabled !== 'boolean'
      ) {
        res.status(400).json({ error: 'Each tool must have name (string), label (string), and enabled (boolean)' });
        return;
      }
    }

    try {
      await toolStore.setTools(body.tools);
      const tools = toolStore.getTools();
      res.json({ tools });
    } catch (error) {
      console.error('Update tools failed:', error);
      res.status(500).json({ error: 'Failed to update tools' });
    }
  });

  return {
    app,
    config,
    index,
    ready,
    async start() {
      await ready;

      if (httpServer?.listening) {
        return httpServer;
      }

      httpServer = http.createServer(app);
      await new Promise<void>((resolve, reject) => {
        httpServer!.once('error', reject);
        httpServer!.listen(config.port, () => {
          httpServer!.off('error', reject);
          resolve();
        });
      });

      const address = httpServer.address() as AddressInfo | null;
      if (address) {
        console.log(`Contextual server running on http://localhost:${address.port}`);
      }

      return httpServer;
    },
    async stop() {
      await index.close();

      if (!httpServer) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        httpServer!.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      httpServer = null;
    },
  };
}
