#!/usr/bin/env node
// =============================================================================
// Contextual Server CLI
// =============================================================================
// Entry point for running the context server from the command line.
// Usage: contextual-server --context-root ./my-project --port 4700
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createServer } from './server.js';
import { DEFAULT_SERVER_PORT } from '@contextual/shared';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const config = {
    port: parseInt(getArg('port') ?? String(DEFAULT_SERVER_PORT), 10),
    contextRoot: path.resolve(getArg('context-root') ?? process.cwd()),
    projectName: getArg('project') ?? 'default',
  };

  try {
    const stats = await fs.stat(config.contextRoot);
    if (!stats.isDirectory()) {
      throw new Error(`Context root is not a directory: ${config.contextRoot}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Context root does not exist: ${config.contextRoot}`;
    console.error(message);
    process.exit(1);
  }

  const server = createServer(config);
  await server.start();

  const health = await server.index.getStats();
  console.log(`Indexed files: ${health.indexedFiles}`);

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down Contextual server...`);
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Failed to shut down cleanly:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
