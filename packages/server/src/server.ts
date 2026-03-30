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
  HealthResponse,
  ResolveRequest,
  ResolveResponse,
  ScaffoldRequest,
  ScaffoldResponse,
  ServerConfig,
  SuggestResponse,
} from '@contextual/shared';
import {
  CONTEXT_TYPES,
  DEFAULT_SERVER_PORT,
  isContextType,
} from '@contextual/shared';
import { ContextIndex } from './indexer/ContextIndex.js';
import { resolveByDepth } from './resolver/depthController.js';
import { scaffold } from './scaffold.js';

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
  const ready = index.ready();
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

    const type = parseSuggestType(req.query.type);
    if (req.query.type && !type) {
      res.status(400).json({ error: 'Query parameter "type" must be a valid context type' });
      return;
    }

    try {
      const suggestions = await index.suggest(partial, type);
      res.json({ suggestions });
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
