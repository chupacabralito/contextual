#!/usr/bin/env node
// =============================================================================
// Contextual Server CLI
// =============================================================================
// Commands:
//   contextual-server init                              # from your project dir
//   contextual-server dev                               # from your project dir
//   contextual-server [serve] --context-root ./my-project --port 4700
//   contextual-server start --context-root ./my-project --port 4700
//   contextual-server scaffold --project-name contextual-context --base-path .
//   contextual-server pair --context-root ./my-project
//   contextual-server pair-status --context-root ./my-project
//   contextual-server unpair --context-root ./my-project
//   contextual-server record-outcome --context-root ./my-project --pass-id pass_123 ...
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import type {
  InstructionReview,
  InstructionReviewStatus,
  OutcomeStatus,
  Pass,
  PassOutcome,
} from '@contextualapp/shared';
import { DEFAULT_SERVER_PORT } from '@contextualapp/shared';
import { createServer } from './server.js';
import { PairingStore } from './dispatch/PairingStore.js';
import { PassStore } from './passes/PassStore.js';
import { OutcomeStore } from './outcomes/OutcomeStore.js';
import { scaffold } from './scaffold.js';
import { init } from './init.js';
import { resolveContextRoot } from './config.js';

const rawArgs = process.argv.slice(2);
const command = rawArgs[0] && !rawArgs[0]!.startsWith('--') ? rawArgs[0]! : 'serve';
const args = command === 'serve' ? rawArgs : rawArgs.slice(1);

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : undefined;
}

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === `--${name}` && typeof args[index + 1] === 'string') {
      values.push(args[index + 1]!);
      index += 1;
    }
  }
  return values;
}

function execFileText(command: string, commandArgs: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, commandArgs, (error, stdout, stderr) => {
      if (error) {
        reject(
          new Error(
            stderr?.trim() || stdout?.trim() || error.message || `Failed to run ${command}`
          )
        );
        return;
      }

      resolve(stdout.trim());
    });
  });
}

function parseOutcomeStatus(value: string | undefined): OutcomeStatus {
  if (
    value === 'pending' ||
    value === 'approved' ||
    value === 'approved-with-feedback' ||
    value === 'rejected'
  ) {
    return value;
  }

  throw new Error(
    `Invalid outcome status '${value ?? ''}'. Expected pending, approved, approved-with-feedback, or rejected.`
  );
}

function defaultInstructionStatus(status: OutcomeStatus): InstructionReviewStatus {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'needs-another-pass';
  return 'looks-good';
}

function parseInstructionFeedbackArgs(values: string[]): Map<string, string> {
  const feedbackByInstruction = new Map<string, string>();

  for (const value of values) {
    const separatorIndex = value.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(
        `Invalid --instruction-feedback value '${value}'. Use --instruction-feedback instructionId=feedback`
      );
    }

    const instructionId = value.slice(0, separatorIndex).trim();
    const feedback = value.slice(separatorIndex + 1).trim();

    if (!instructionId || !feedback) {
      throw new Error(
        `Invalid --instruction-feedback value '${value}'. Use --instruction-feedback instructionId=feedback`
      );
    }

    feedbackByInstruction.set(instructionId, feedback);
  }

  return feedbackByInstruction;
}

function buildInstructionReviews(
  pass: Pass,
  status: OutcomeStatus,
  looksGoodIds: Set<string>,
  needsAnotherPassIds: Set<string>,
  instructionFeedback: Map<string, string>,
  reviewedAt: string,
): InstructionReview[] {
  const fallbackStatus = defaultInstructionStatus(status);

  return pass.instructions.map((instruction) => {
    let instructionStatus = fallbackStatus;

    if (looksGoodIds.has(instruction.id)) {
      instructionStatus = 'looks-good';
    }

    if (needsAnotherPassIds.has(instruction.id)) {
      instructionStatus = 'needs-another-pass';
    }

    return {
      instructionId: instruction.id,
      elementLabel: instruction.element.label,
      rawText: instruction.rawText,
      status: instructionStatus,
      feedback: instructionFeedback.get(instruction.id),
      reviewedAt,
    };
  });
}

function buildOutcomeSummary(status: OutcomeStatus): string {
  switch (status) {
    case 'approved':
      return 'Executed from the terminal and marked approved.';
    case 'approved-with-feedback':
      return 'Executed from the terminal and approved with follow-up notes.';
    case 'rejected':
      return 'Executed from the terminal and marked as needing another pass.';
    case 'pending':
    default:
      return 'Terminal execution recorded, awaiting review.';
  }
}

async function ensureContextRootExists(contextRoot: string): Promise<void> {
  try {
    const stats = await fs.stat(contextRoot);
    if (!stats.isDirectory()) {
      throw new Error(`Context root is not a directory: ${contextRoot}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Context root does not exist: ${contextRoot}`;
    throw new Error(message);
  }
}

async function detectCurrentTty(): Promise<string> {
  // process.stdin has the TTY path when running interactively.
  // We can't shell out to `tty` because execFile pipes stdin.
  if (process.stdin.isTTY) {
    // On macOS/Linux, /dev/fd/0 links to the real TTY.
    // Read the symlink to get the actual /dev/ttysNNN path.
    try {
      const realPath = await fs.readlink('/dev/fd/0');
      if (realPath.startsWith('/dev/tty')) {
        return realPath;
      }
    } catch {
      // readlink may fail — fall through
    }

    // Fallback: use the `tty` command with stdin inherited
    const { execSync } = await import('node:child_process');
    try {
      const result = execSync('tty', { stdio: ['inherit', 'pipe', 'pipe'] }).toString().trim();
      if (result && result !== 'not a tty') {
        return result;
      }
    } catch {
      // fall through
    }
  }

  throw new Error('No TTY detected. Run `contextual-server pair` inside the Terminal tab you want to pair.');
}

async function runPair(): Promise<void> {
  const { contextRoot, source } = await resolveContextRoot({
    explicitContextRoot: getArg('context-root'),
  });
  await ensureContextRootExists(contextRoot);

  const termProgram = getArg('term-program') ?? process.env.TERM_PROGRAM ?? '';
  if (termProgram !== 'Apple_Terminal') {
    throw new Error(
      `Pairing currently supports Terminal.app only. Current TERM_PROGRAM is '${termProgram || 'unknown'}'.`
    );
  }

  const tty = getArg('tty') ?? (await detectCurrentTty());
  const pairingStore = new PairingStore(contextRoot);
  const pairing = await pairingStore.savePairing({
    tty,
    termProgram,
    workingDirectory: process.cwd(),
  });

  // Validate the server can see this pairing
  const port = parseInt(getArg('port') ?? String(DEFAULT_SERVER_PORT), 10);
  let serverReachable = false;
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    serverReachable = res.ok;
  } catch {
    // server not running
  }

  console.log('');
  console.log(`  Paired to: ${contextRoot}`);
  console.log(`  TTY:       ${pairing.tty}`);
  console.log(`  File:      ${pairingStore.getPairingPath()}`);
  console.log(`  Resolved via: ${source}`);
  if (!serverReachable) {
    console.log('');
    console.log(`  Warning: Contextual server not reachable at localhost:${port}.`);
    console.log(`  Run \`contextual-server start\` first, then pair.`);
  }
  console.log('');
}

async function runPairStatus(): Promise<void> {
  const { contextRoot } = await resolveContextRoot({
    explicitContextRoot: getArg('context-root'),
  });
  await ensureContextRootExists(contextRoot);

  const pairingStore = new PairingStore(contextRoot);
  const pairing = await pairingStore.getPairing();

  // Check if the paired TTY is still alive
  let ttyAlive = false;
  if (pairing?.tty) {
    try {
      await fs.access(pairing.tty);
      ttyAlive = true;
    } catch {
      // TTY no longer exists
    }
  }

  console.log(
    JSON.stringify(
      {
        paired: pairing !== null,
        ttyAlive,
        path: pairingStore.getPairingPath(),
        pairing,
      },
      null,
      2,
    ),
  );
}

async function runUnpair(): Promise<void> {
  const { contextRoot } = await resolveContextRoot({
    explicitContextRoot: getArg('context-root'),
  });
  await ensureContextRootExists(contextRoot);

  const pairingStore = new PairingStore(contextRoot);
  const cleared = await pairingStore.clearPairing();

  console.log(
    JSON.stringify(
      {
        ok: true,
        cleared,
        path: pairingStore.getPairingPath(),
      },
      null,
      2,
    ),
  );
}

async function runDev(): Promise<void> {
  const projectDir = path.resolve(getArg('project-dir') ?? process.cwd());

  // Resolve the contextual monorepo root
  const cliDir = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
  const contextualRoot = path.resolve(cliDir, '..', '..', '..');
  const devScript = path.join(contextualRoot, 'scripts', 'dev.sh');

  const { execSync } = await import('node:child_process');
  try {
    execSync(`bash "${devScript}" --app-dir "${projectDir}"`, {
      cwd: contextualRoot,
      stdio: 'inherit',
    });
  } catch {
    // execSync throws on non-zero exit (e.g. Ctrl+C) — that's expected
  }
}

function deriveProjectName(contextRoot: string): string {
  // If the context root ends with .contextual, use the parent directory name
  const base = path.basename(contextRoot);
  const dirName = base === '.contextual' ? path.basename(path.dirname(contextRoot)) : base;

  // Convert kebab-case / snake_case to Title Case
  return dirName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function runServe(): Promise<void> {
  await runHttpServer({ serveUi: false });
}

async function runStart(): Promise<void> {
  await runHttpServer({ serveUi: true });
}

async function runHttpServer(options: { serveUi: boolean }): Promise<void> {
  const { contextRoot } = await resolveContextRoot({
    explicitContextRoot: getArg('context-root'),
  });
  const config = {
    port: parseInt(getArg('port') ?? String(DEFAULT_SERVER_PORT), 10),
    contextRoot,
    projectName: getArg('project') ?? deriveProjectName(contextRoot),
  };

  await ensureContextRootExists(config.contextRoot);

  const server = createServer({
    ...config,
    serveUi: options.serveUi,
  });
  await server.start();

  const health = await server.index.getStats();
  console.log(`Indexed files: ${health.indexedFiles}`);
  if (options.serveUi) {
    console.log(`Context manager available at http://localhost:${config.port}`);
  }

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

async function runInit(): Promise<void> {
  const projectDir = path.resolve(getArg('project-dir') ?? process.cwd());
  const projectName = getArg('project');

  // Optionally resolve the contextual monorepo root for contributor dev.
  // When running as a published package, this isn't needed.
  let contextualRoot: string | undefined;
  try {
    const cliDir = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
    const candidate = path.resolve(cliDir, '..', '..', '..');
    const monorepoMarker = path.join(candidate, 'packages', 'server', 'package.json');
    await fs.access(monorepoMarker);
    contextualRoot = candidate;
  } catch {
    // Not running from monorepo — that's fine
  }

  const result = await init({
    projectDir,
    contextualRoot,
    projectName: projectName || undefined,
  });

  // Print steps as human-readable output
  console.log('');
  console.log(`  Contextual initialized for ${result.projectName}`);
  console.log(`  Framework: ${result.framework}`);
  console.log('');
  for (const step of result.steps) {
    console.log(`  ${step.startsWith('Warning') ? '⚠' : '✓'}  ${step}`);
  }
  console.log('');

  if (result.depsAdded) {
    console.log('  Next steps:');
    console.log(`    1. Run \`npm install\``);
    console.log(`    2. Start Contextual:`);
    console.log(`       contextual-server start`);
  } else {
    console.log('  Start Contextual:');
    console.log(`    contextual-server start`);
  }
  console.log('');
}

async function runScaffold(): Promise<void> {
  const projectName = getArg('project-name');
  const basePath = path.resolve(getArg('base-path') ?? process.cwd());

  if (!projectName) {
    throw new Error('scaffold requires --project-name');
  }

  const result = await scaffold({
    projectName,
    basePath,
  });

  console.log(JSON.stringify(result, null, 2));
}

async function runRecordOutcome(): Promise<void> {
  const { contextRoot } = await resolveContextRoot({
    explicitContextRoot: getArg('context-root'),
  });
  const passId = getArg('pass-id');
  const status = parseOutcomeStatus(getArg('status') ?? 'approved');

  if (!passId) {
    throw new Error('record-outcome requires --pass-id');
  }

  await ensureContextRootExists(contextRoot);

  const passStore = new PassStore(contextRoot);
  const outcomeStore = new OutcomeStore(contextRoot);
  await Promise.all([passStore.initialize(), outcomeStore.initialize()]);

  const pass = await passStore.getPass(passId);
  if (!pass) {
    throw new Error(`Pass not found: ${passId}`);
  }

  const looksGoodIds = new Set(getArgs('looks-good'));
  const needsAnotherPassIds = new Set(getArgs('needs-another-pass'));
  const instructionFeedback = parseInstructionFeedbackArgs(getArgs('instruction-feedback'));

  const validInstructionIds = new Set(pass.instructions.map((instruction) => instruction.id));
  for (const instructionId of [...looksGoodIds, ...needsAnotherPassIds, ...instructionFeedback.keys()]) {
    if (!validInstructionIds.has(instructionId)) {
      throw new Error(`Instruction not found in pass '${passId}': ${instructionId}`);
    }
  }

  const timestamp = new Date().toISOString();
  const instructionReviews = buildInstructionReviews(
    pass,
    status,
    looksGoodIds,
    needsAnotherPassIds,
    instructionFeedback,
    timestamp,
  );

  const outcome: PassOutcome = {
    id: `outcome_${Date.now()}`,
    passId: pass.id,
    timestamp,
    status,
    project: pass.project,
    affectedContextTypes: pass.affectedContextTypes ?? [],
    loadedContextPaths: pass.loadedContextPaths ?? [],
    summary: getArg('summary') ?? buildOutcomeSummary(status),
    feedback: getArg('feedback'),
    instructionReviews,
    changedFiles: getArgs('changed-file'),
    writebacks: [],
  };

  const outcomePath = await outcomeStore.createOutcome(outcome);

  console.log(
    JSON.stringify(
      {
        id: outcome.id,
        path: outcomePath,
        timestamp: outcome.timestamp,
        passId: outcome.passId,
        status: outcome.status,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  switch (command) {
    case 'init':
      await runInit();
      return;
    case 'dev':
      await runDev();
      return;
    case 'serve':
      await runServe();
      return;
    case 'start':
      await runStart();
      return;
    case 'pair':
      await runPair();
      return;
    case 'pair-status':
      await runPairStatus();
      return;
    case 'unpair':
      await runUnpair();
      return;
    case 'record-outcome':
      await runRecordOutcome();
      return;
    case 'scaffold':
      await runScaffold();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
