// =============================================================================
// Context Server
// =============================================================================
// Express server that handles @mention resolution requests from the
// React annotation component. Runs locally on the designer's machine.
// =============================================================================

import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import matter from 'gray-matter';
import type {
  ContextPriority,
  ContextType,
  CompiledFileMeta,
  CorpusResponse,
  CorpusTypeEntry,
  CreateProjectRequest,
  CreateProjectResponse,
  CreateOutcomeRequest,
  CreateOutcomeResponse,
  ImportRequest,
  ImportResponse,
  OutcomeStatus,
  ProjectBrief,
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectSummary,
  SectionResponse,
  SourceFile,
  SourceContentResponse,
  SourceListResponse,
  CompiledFileResponse,
  AddSourceRequest,
  AddSourceResponse,
  CreatePassRequest,
  CreatePassResponse,
  HealthResponse,
  InspectResponse,
  OutcomeListResponse,
  PairingStatusResponse,
  PassOutcome,
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
  DiscoveredFile,
  DiscoverResponse,
  DiscoverImportRequest,
  DiscoverImportResponse,
} from '@contextual/shared';
import {
  CONTEXT_TYPES,
  DEFAULT_LEARNED_FOLDERS,
  DEFAULT_PRIORITIES,
  DEFAULT_SERVER_PORT,
  isContextType,
} from '@contextual/shared';
import { PairingStore } from './dispatch/PairingStore.js';
import { ContextIndex } from './indexer/ContextIndex.js';
import { resolveByDepth } from './resolver/depthController.js';
import { ensureFlywheelArtifacts, scaffold } from './scaffold.js';
import { PassStore } from './passes/PassStore.js';
import { OutcomeStore } from './outcomes/OutcomeStore.js';
import { ToolStore } from './tools/ToolStore.js';
import { normalizePassBase, normalizeOutcomeBase } from './normalize.js';

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

interface ProjectPassInstruction {
  elementLabel: string;
  rawText: string;
}

interface ProjectPassRecord {
  id: string;
  timestamp: string;
  project?: string;
  instructionCount: number;
  instructions: ProjectPassInstruction[];
}

interface ProjectOutcomeRecord {
  id: string;
  passId: string;
  timestamp: string;
  status: OutcomeStatus;
  project?: string;
  summary?: string;
  feedback?: string;
  changedFileCount: number;
  writebackCount: number;
}

interface CreateServerOptions extends Partial<ServerConfig> {
  serveUi?: boolean;
  uiDir?: string;
}

const VALID_RESOLUTION_DEPTHS: Set<string> = new Set([
  'light', 'standard', 'detailed', 'full',
]);

function isResolveRequest(value: unknown): value is ResolveRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as ResolveRequest;
  return (
    Array.isArray(request.mentions) &&
    (request.depth === undefined || VALID_RESOLUTION_DEPTHS.has(request.depth)) &&
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

function getDefaultUiDir(): string {
  const serverDistDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(serverDistDir, 'context-manager');
}

function injectRuntimeApiBase(html: string): string {
  const runtimeScript = [
    '<script>',
    'window.__CONTEXTUAL_SERVER_URL__ = window.location.origin;',
    '</script>',
  ].join('');

  if (html.includes('</head>')) {
    return html.replace('</head>', `  ${runtimeScript}\n</head>`);
  }

  return `${runtimeScript}\n${html}`;
}

function isReservedServerPath(requestPath: string): boolean {
  const reservedPrefixes = [
    '/api',
    '/passes',
    '/outcomes',
    '/resolve',
    '/suggest',
    '/inspect',
    '/tools',
    '/health',
  ];

  return reservedPrefixes.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`)
  );
}

const VALID_OUTCOME_STATUSES: Set<string> = new Set([
  'pending',
  'approved',
  'approved-with-feedback',
  'rejected',
]);

function isCreateOutcomeRequest(value: unknown): value is CreateOutcomeRequest {
  if (!value || typeof value !== 'object') return false;

  const request = value as CreateOutcomeRequest;
  return (
    !!request.outcome &&
    typeof request.outcome === 'object' &&
    typeof request.outcome.id === 'string' &&
    typeof request.outcome.passId === 'string' &&
    typeof request.outcome.timestamp === 'string' &&
    typeof request.outcome.status === 'string' &&
    VALID_OUTCOME_STATUSES.has(request.outcome.status) &&
    Array.isArray(request.outcome.changedFiles) &&
    Array.isArray(request.outcome.writebacks)
  );
}

function normalizePass(payload: Pass, fallbackProject: string): Pass {
  const base = normalizePassBase(payload);
  return {
    ...base,
    project: base.project ?? fallbackProject,
  };
}

function isValidInstructionReview(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const review = value as Record<string, unknown>;
  return (
    typeof review.instructionId === 'string' &&
    typeof review.elementLabel === 'string' &&
    typeof review.rawText === 'string' &&
    typeof review.status === 'string'
  );
}

function normalizeOutcome(payload: PassOutcome, fallbackProject: string): PassOutcome {
  const base = normalizeOutcomeBase(payload);
  return {
    ...base,
    project: base.project ?? fallbackProject,
    // Extra server-side validation: filter out malformed instruction reviews
    instructionReviews: (base.instructionReviews ?? []).filter(isValidInstructionReview),
  };
}

function parseSuggestType(value: unknown): ContextType | undefined {
  if (typeof value !== 'string') return undefined;
  return isContextType(value) ? value as ContextType : undefined;
}

const SOURCE_EXTENSIONS = new Set(['.md', '.txt', '.json']);

function buildTerminalDispatchPrompt(
  passPathForPrompt: string,
  pass: Pass,
  config: ServerConfig,
): string {
  const escapedContextRoot = config.contextRoot.replace(/"/g, '\\"');
  const escapedPassId = pass.id.replace(/"/g, '\\"');

  return [
    `New pass submitted. Read ${passPathForPrompt} and execute all instructions.`,
    `When finished, record the result so Contextual can sync it back into the toolbar.`,
    'Run this and adjust the flags to match what happened:',
    `contextual-server record-outcome --context-root "${escapedContextRoot}" --pass-id "${escapedPassId}" --status approved-with-feedback --summary "..." --feedback "..."`,
    'Add --changed-file "<path>" for each changed file.',
    'Use --looks-good "<instruction-id>" or --needs-another-pass "<instruction-id>" to override instruction results.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Agent dispatch: send pass prompt to a paired Claude Code session
// ---------------------------------------------------------------------------
// Uses a paired Terminal.app TTY stored under the context root.
// Pairing is explicit: `contextual-server pair --context-root ...` must be run
// inside the exact Terminal tab that should receive pass prompts.
// ---------------------------------------------------------------------------

/**
 * AppleScript: activate a paired Terminal tab by TTY, then type into it.
 */
function dispatchViaPairedTerminalKeystroke(text: string, ttyPath: string): Promise<void> {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedTty = ttyPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const script = [
    'tell application "Terminal"',
    '  set matchedWindow to missing value',
    '  set matchedTab to missing value',
    '  repeat with theWindow in windows',
    '    repeat with theTab in tabs of theWindow',
    `      if tty of theTab is "${escapedTty}" then`,
    '        set matchedWindow to theWindow',
    '        set matchedTab to theTab',
    '        exit repeat',
    '      end if',
    '    end repeat',
    '    if matchedTab is not missing value then exit repeat',
    '  end repeat',
    '  if matchedTab is missing value then',
    '    error "Paired Terminal tab not found" number 10001',
    '  end if',
    '  activate',
    '  set index of matchedWindow to 1',
    '  set selected tab of matchedWindow to matchedTab',
    'end tell',
    'tell application "System Events"',
    `  keystroke "${escaped}"`,
    '  delay 0.3',
    '  keystroke return',
    'end tell',
  ].join('\n');

  return new Promise((resolve, reject) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Dispatch a pass prompt to the paired Claude Code session for this context root.
 */
async function dispatchToAgent(text: string, contextRoot: string): Promise<void> {
  const pairingStore = new PairingStore(contextRoot);
  const pairing = await pairingStore.getPairing();

  if (!pairing) {
    console.warn(
      '[contextual-server] No paired Terminal session found. ' +
      'Run `contextual-server pair --context-root "<path>"` inside the Terminal tab that should receive passes.'
    );
    return;
  }

  try {
    await dispatchViaPairedTerminalKeystroke(text, pairing.tty);
    console.log(`[contextual-server] Pass dispatched to paired Terminal session ${pairing.tty}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[contextual-server] Paired Terminal dispatch failed for ${pairing.tty}: ${message}`
    );
    console.error(
      '[contextual-server] Re-run `contextual-server pair --context-root "<path>"` in the desired Terminal tab.'
    );
  }
}

/**
 * Create and configure the context server.
 */
export function createServer(configInput: CreateServerOptions = {}): ContextualServer {
  const config: ServerConfig = {
    port: configInput.port ?? DEFAULT_SERVER_PORT,
    contextRoot: configInput.contextRoot ?? process.cwd(),
    projectName: configInput.projectName ?? 'default',
  };
  const serveUi = configInput.serveUi === true;
  const uiDir = path.resolve(configInput.uiDir ?? getDefaultUiDir());

  const app = express();
  const index = new ContextIndex(config.contextRoot);
  const passStore = new PassStore(config.contextRoot);
  const outcomeStore = new OutcomeStore(config.contextRoot);
  const toolStore = new ToolStore(config.contextRoot);
  const uiIndexPath = path.join(uiDir, 'index.html');
  const ready = Promise.all([
    index.ready(),
    passStore.initialize(),
    outcomeStore.initialize(),
    toolStore.initialize(),
    ensureFlywheelArtifacts(config.contextRoot),
    serveUi ? fs.access(uiIndexPath) : Promise.resolve(),
  ]).then(() => {}).catch((error) => {
    console.error('[contextual-server] Initialization failed:', error);
    throw error;
  });
  let httpServer: http.Server | null = null;

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use((req, _res, next) => {
    // Suppress noisy polling requests from the context manager (every 5s per type).
    // Only log mutations (POST/PUT/DELETE) and non-routine reads.
    const isPollingGet =
      req.method === 'GET' &&
      (req.path.match(/^\/api\/corpus(\/|$)/) ||
        req.path.match(/^\/api\/corpus\/[^/]+\/sources$/) ||
        req.path.match(/^\/passes\/[^/]+\/outcome$/) ||
        req.path === '/api/pairing' ||
        req.path === '/passes' ||
        req.path === '/outcomes' ||
        req.path === '/api/projects');
    if (!isPollingGet) {
      console.log(`[contextual-server] ${req.method} ${req.path}`);
    }
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

  app.get('/api/pairing', async (_req, res: express.Response<PairingStatusResponse | ServerErrorResponse>) => {
    try {
      const pairingStore = new PairingStore(config.contextRoot);
      const pairing = await pairingStore.getPairing();
      const escapedContextRoot = config.contextRoot.replace(/"/g, '\\"');

      res.json({
        paired: pairing !== null,
        path: pairingStore.getPairingPath(),
        suggestedCommand: `contextual-server pair --context-root "${escapedContextRoot}"`,
        pairing,
      });
    } catch (error) {
      console.error('Pairing status failed:', error);
      res.status(500).json({ error: 'Failed to read pairing status' });
    }
  });

  // ---------------------------------------------------------------------------
  // Corpus Endpoints (Context Manager UI)
  // ---------------------------------------------------------------------------

  // Helper: check if a path exists
  async function pathExists(p: string): Promise<boolean> {
    try {
      await fs.stat(p);
      return true;
    } catch {
      return false;
    }
  }

  async function ensureDir(directory: string): Promise<void> {
    await fs.mkdir(directory, { recursive: true });
  }

  function getTypePaths(type: ContextType) {
    const typeDir = path.join(config.contextRoot, type);
    return {
      typeDir,
      compiledPath: path.join(typeDir, 'compiled.md'),
      sourcesDir: path.join(typeDir, '_sources'),
    };
  }

  function getProjectPaths(name: string) {
    const projectDir = path.join(config.contextRoot, '_projects', name);
    return {
      projectDir,
      briefPath: path.join(projectDir, 'brief.md'),
      passesDir: path.join(projectDir, 'passes'),
      outcomesDir: path.join(projectDir, 'outcomes'),
      learnedDir: path.join(projectDir, 'learned'),
    };
  }

  async function writeFileAtomic(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp-${crypto.randomUUID()}`;
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, filePath);
  }

  function sanitizeFilename(filename: string): string {
    let decoded: string;
    try {
      decoded = decodeURIComponent(filename);
    } catch {
      throw new Error(`Invalid filename (malformed encoding): "${filename}"`);
    }
    const basename = path.basename(decoded);
    if (!basename || basename === '.' || basename === '..') {
      throw new Error(`Invalid filename: "${filename}"`);
    }
    return basename;
  }

  async function listSourceFilenames(sourcesDir: string): Promise<string[]> {
    if (!(await pathExists(sourcesDir))) {
      return [];
    }

    const entries = await fs.readdir(sourcesDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  }

  async function ensureLearnedArtifacts(baseDir: string): Promise<void> {
    const learnedDir = path.join(baseDir, 'learned');
    await ensureDir(path.join(baseDir, 'passes'));
    await ensureDir(path.join(baseDir, 'outcomes'));
    await ensureDir(learnedDir);

    await Promise.all(
      DEFAULT_LEARNED_FOLDERS.map((folder) => ensureDir(path.join(learnedDir, folder)))
    );

    const indexPath = path.join(learnedDir, 'INDEX.md');
    if (!(await pathExists(indexPath))) {
      const content = [
        '# Learned Policy',
        '',
        'This directory stores durable learnings distilled from completed passes.',
        '',
        '- `operator-preferences/` captures stable approval and style preferences.',
        '- `ui-patterns/` stores reusable UI patterns for future passes.',
        '- `tool-routing/` records which tools and data sources to use.',
        '- `project-decisions/` stores project-specific rules that should persist.',
        '',
      ].join('\n');
      await writeFileAtomic(indexPath, content);
    }
  }

  // Helper: auto-ingest .md/.txt/.json files from type root into _sources/
  async function autoIngestRootFiles(typeDir: string, sourcesDir: string): Promise<number> {
    if (!(await pathExists(typeDir))) return 0;

    let ingested = 0;
    try {
      const entries = await fs.readdir(typeDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!SOURCE_EXTENSIONS.has(ext)) continue;
        // Skip compiled output and README
        if (entry.name === 'compiled.md' || entry.name === 'README.md') continue;

        await fs.mkdir(sourcesDir, { recursive: true });
        const src = path.join(typeDir, entry.name);
        const dest = path.join(sourcesDir, entry.name);
        if (!(await pathExists(dest))) {
          await fs.rename(src, dest);
          ingested++;
        }
      }
    } catch { /* ignore read errors on type dirs that don't exist */ }
    return ingested;
  }

  // Helper: auto-compile sources into compiled.md for a type
  async function compileSourcesForType(type: ContextType): Promise<void> {
    const { typeDir, sourcesDir, compiledPath } = getTypePaths(type);
    const sources = await listSourceFiles(type);
    if (sources.length === 0) return;

    const sections: string[] = [];
    const timestamp = new Date().toISOString();
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');

    sections.push('---');
    sections.push(`type: ${type}`);
    sections.push(`title: ${typeLabel} Context`);
    sections.push(`lastCompiled: "${timestamp}"`);
    sections.push(`sourceCount: ${sources.length}`);
    sections.push('---');
    sections.push('');
    sections.push(`# ${typeLabel} Context`);
    sections.push('');

    for (const source of sources) {
      const filePath = path.join(sourcesDir, source.filename);
      try {
        let raw = await fs.readFile(filePath, 'utf-8');
        raw = raw.replace(/^<!--\s*.*?\s*-->\s*\n*/m, '');
        const label = source.filename.replace(/\.(md|markdown|txt|json)$/, '');
        sections.push(`## ${label}`);
        sections.push('');
        sections.push(raw.trim());
        sections.push('');
      } catch { /* skip unreadable files */ }
    }

    const compiledContent = sections.join('\n');
    await fs.writeFile(compiledPath, compiledContent, 'utf-8');
  }

  // Helper: auto-generate brief.md when sources exist but no brief.
  // Reads compiled.md for each type and synthesizes the actual content.
  async function autoGenerateBrief(types: CorpusTypeEntry[]): Promise<void> {
    const briefPath = path.join(config.contextRoot, 'brief.md');
    const displayName = config.projectName;

    const timestamp = new Date().toISOString();
    const lines: string[] = [
      '---',
      `title: "${displayName}"`,
      `description: ""`,
      `lastCompiled: "${timestamp}"`,
      '---',
      '',
      `# ${displayName}`,
      '',
    ];

    // Read compiled content from each type that has sources and include it
    let hasContent = false;

    for (const t of types) {
      if (t.sourceCount === 0) continue;
      const compiled = await readCompiledFile(t.type);
      if (compiled && compiled.content.trim()) {
        const label = t.type.charAt(0).toUpperCase() + t.type.slice(1).replace(/-/g, ' ');
        lines.push(`## ${label}`);
        lines.push('');
        lines.push(compiled.content.trim());
        lines.push('');
        hasContent = true;
      }
    }

    if (!hasContent) {
      lines.push('No context sources have been compiled yet.');
      lines.push('');
    }

    await fs.writeFile(briefPath, lines.join('\n'), 'utf-8');
  }

  // Helper: estimate tokens from text (word count * 1.3)
  function estimateTokens(text: string): number {
    return Math.round(text.split(/\s+/).filter(Boolean).length * 1.3);
  }

  // Helper: parse sections from markdown content
  function parseSections(content: string): CompiledFileMeta['sections'] {
    const lines = content.split('\n');
    const sections: CompiledFileMeta['sections'] = [];
    let currentSection: { title: string; startLine: number; lines: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^##\s+(.+)/);
      if (headingMatch) {
        if (currentSection) {
          sections.push({
            title: currentSection.title,
            startLine: currentSection.startLine,
            endLine: i - 1,
            tokenEstimate: estimateTokens(currentSection.lines.join('\n')),
          });
        }
        currentSection = { title: headingMatch[1], startLine: i + 1, lines: [] };
      } else if (currentSection) {
        currentSection.lines.push(line);
      }
    }

    if (currentSection) {
      sections.push({
        title: currentSection.title,
        startLine: currentSection.startLine,
        endLine: lines.length,
        tokenEstimate: estimateTokens(currentSection.lines.join('\n')),
      });
    }

    return sections;
  }

  // Helper: read compiled.md for a type, returns null if not found
  async function readCompiledFile(type: ContextType): Promise<{ meta: CompiledFileMeta; content: string } | null> {
    const { compiledPath, sourcesDir } = getTypePaths(type);
    try {
      const raw = await fs.readFile(compiledPath, 'utf-8');
      const { data: frontmatter, content } = matter(raw);
      const sections = parseSections(content);
      const totalTokenEstimate = sections.reduce((sum, s) => sum + s.tokenEstimate, 0) || estimateTokens(content);

      const sourceCount = (await listSourceFilenames(sourcesDir)).length;

      const meta: CompiledFileMeta = {
        type,
        title: (frontmatter.title as string) ?? `${type} Context`,
        lastCompiled: (frontmatter.lastCompiled as string) ?? (frontmatter.date as string) ?? new Date().toISOString(),
        sourceCount,
        sections,
        totalTokenEstimate,
        priority: (frontmatter.priority as CompiledFileMeta['priority']) ?? DEFAULT_PRIORITIES[type],
      };

      return { meta, content: content.trim() };
    } catch {
      return null;
    }
  }

  // Helper: list source files for a type (all .md/.json in _sources/)
  async function listSourceFiles(type: ContextType): Promise<SourceFile[]> {
    const { sourcesDir } = getTypePaths(type);
    try {
      const entries = await fs.readdir(sourcesDir);
      const sourceFiles: SourceFile[] = [];

      for (const filename of entries) {
        if (!filename.endsWith('.md') && !filename.endsWith('.json') && !filename.endsWith('.txt')) continue;

        const filePath = path.join(sourcesDir, filename);
        try {
          const stat = await fs.stat(filePath);
          const raw = await fs.readFile(filePath, 'utf-8');
          sourceFiles.push({
            filename,
            size: stat.size,
            preview: raw.slice(0, 400).replace(/\s+/g, ' ').trim(),
            addedAt: stat.birthtime.toISOString(),
          });
        } catch { /* skip unreadable files */ }
      }

      // Sort by date descending
      sourceFiles.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      return sourceFiles;
    } catch {
      return [];
    }
  }

  function rewriteFrontmatterField(content: string, key: string, value: string): string {
    const lines = content.split(/\r?\n/);
    if (lines[0]?.trim() !== '---') {
      throw new Error('Compiled file has invalid frontmatter');
    }

    const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (closingIndex === -1) {
      throw new Error('Compiled file has invalid frontmatter');
    }

    const frontmatterLines = lines.slice(1, closingIndex);
    const bodyLines = lines.slice(closingIndex + 1);
    const nextLine = `${key}: ${value}`;
    const existingIndex = frontmatterLines.findIndex((line) =>
      new RegExp(`^${key}:\\s*`).test(line)
    );

    if (existingIndex >= 0) {
      frontmatterLines[existingIndex] = nextLine;
    } else {
      frontmatterLines.push(nextLine);
    }

    return ['---', ...frontmatterLines, '---', ...bodyLines].join('\n');
  }

  async function readProductBrief(): Promise<{ title: string; description: string; content: string }> {
    const briefPath = path.join(config.contextRoot, 'brief.md');

    try {
      const raw = await fs.readFile(briefPath, 'utf8');
      const parsed = matter(raw);
      return {
        title: typeof parsed.data.title === 'string' ? parsed.data.title : '',
        description: typeof parsed.data.description === 'string' ? parsed.data.description : '',
        content: parsed.content.trim(),
      };
    } catch {
      return { title: '', description: '', content: '' };
    }
  }

  async function updateProductBrief(content: string): Promise<void> {
    const briefPath = path.join(config.contextRoot, 'brief.md');

    // If the content is empty, delete the file so it auto-regenerates on next load
    if (!content.trim()) {
      try { await fs.unlink(briefPath); } catch { /* already gone */ }
      return;
    }

    let fileContent = content;

    if (await pathExists(briefPath)) {
      const raw = await fs.readFile(briefPath, 'utf8');
      const parsed = matter(raw);
      const incoming = matter(content);
      if (Object.keys(incoming.data).length === 0) {
        fileContent = matter.stringify(content, parsed.data);
      }
    }

    await writeFileAtomic(briefPath, fileContent);
  }

  async function getSectionResponse(type: ContextType, index: number): Promise<SectionResponse> {
    const compiled = await readCompiledFile(type);
    if (!compiled) {
      throw new Error(`No compiled file for type: ${type}`);
    }

    const section = compiled.meta.sections[index];
    if (!section) {
      throw new Error(`No section ${index} for type '${type}'`);
    }

    const bodyLines = compiled.content.split(/\r?\n/);
    return {
      section,
      content: bodyLines.slice(section.startLine - 1, section.endLine).join('\n'),
    };
  }

  async function getSourceContent(type: ContextType, filename: string): Promise<SourceContentResponse> {
    const safeFilename = sanitizeFilename(filename);
    const { sourcesDir } = getTypePaths(type);
    const filePath = path.join(sourcesDir, safeFilename);

    if (!(await pathExists(filePath))) {
      throw new Error(`Source file not found: ${safeFilename}`);
    }

    return {
      filename: safeFilename,
      content: await fs.readFile(filePath, 'utf8'),
    };
  }

  async function updateCompiledPriority(
    type: ContextType,
    priority: ContextPriority
  ): Promise<ContextPriority> {
    const { compiledPath } = getTypePaths(type);
    if (!(await pathExists(compiledPath))) {
      throw new Error(`No compiled file for type '${type}'`);
    }

    const raw = await fs.readFile(compiledPath, 'utf8');
    const updated = rewriteFrontmatterField(raw, 'priority', priority);
    await writeFileAtomic(compiledPath, updated);
    return priority;
  }

  async function importCorpus(request: ImportRequest): Promise<ImportResponse> {
    if (!request.sourcePath || !Array.isArray(request.types)) {
      throw new Error('Request body must include "sourcePath" and "types"');
    }

    const sourceRoot = path.resolve(request.sourcePath);
    const imported: ImportResponse['imported'] = [];

    for (const type of request.types) {
      if (!isContextType(type)) {
        throw new Error(`Invalid context type in import: '${type}'`);
      }

      const sourceTypeDir = path.join(sourceRoot, type);
      const sourceCompiledPath = path.join(sourceTypeDir, 'compiled.md');
      const sourceSourcesDir = path.join(sourceTypeDir, '_sources');
      const destinationPaths = getTypePaths(type);
      const copiedFiles: string[] = [];

      await ensureDir(destinationPaths.typeDir);
      await ensureDir(destinationPaths.sourcesDir);

      if (await pathExists(sourceCompiledPath)) {
        await fs.copyFile(sourceCompiledPath, destinationPaths.compiledPath);
        copiedFiles.push('compiled.md');
      }

      const sourceFiles = await listSourceFilenames(sourceSourcesDir);
      for (const filename of sourceFiles) {
        const fromPath = path.join(sourceSourcesDir, filename);
        const toPath = path.join(destinationPaths.sourcesDir, filename);
        await fs.copyFile(fromPath, toPath);
        copiedFiles.push(`_sources/${filename}`);
      }

      imported.push({ type, files: copiedFiles });
    }

    return { imported };
  }

  /** Coerce a value to an ISO string (gray-matter parses ISO timestamps as Date objects) */
  function toISOString(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    return null;
  }

  async function readProjectBrief(briefPath: string): Promise<ProjectBrief | null> {
    if (!(await pathExists(briefPath))) {
      return null;
    }

    const raw = await fs.readFile(briefPath, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const activeTypes = Array.isArray(data.activeTypes)
      ? data.activeTypes.filter((type): type is ContextType => isContextType(type))
      : [];

    const createdAt = toISOString(data.createdAt);
    const lastActivityAt = toISOString(data.lastActivityAt);

    if (
      typeof data.name !== 'string' ||
      typeof data.title !== 'string' ||
      !createdAt ||
      !lastActivityAt
    ) {
      return null;
    }

    const body = parsed.content.trim();
    return {
      name: data.name,
      title: data.title,
      description:
        typeof data.description === 'string' && data.description.trim() ? data.description : body,
      createdAt,
      lastActivityAt,
      activeTypes,
      body: body || undefined,
    };
  }

  function toProjectPassRecord(value: unknown): ProjectPassRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as {
      id?: unknown;
      timestamp?: unknown;
      project?: unknown;
      instructions?: unknown;
    };

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.timestamp !== 'string' ||
      !Array.isArray(candidate.instructions)
    ) {
      return null;
    }

    const instructions: ProjectPassInstruction[] = candidate.instructions.map(
      (instruction: { element?: { label?: string }; rawText?: string }) => ({
        elementLabel: instruction?.element?.label ?? 'Unknown element',
        rawText: typeof instruction?.rawText === 'string' ? instruction.rawText : '',
      })
    );

    return {
      id: candidate.id,
      timestamp: candidate.timestamp,
      project: typeof candidate.project === 'string' ? candidate.project : undefined,
      instructionCount: candidate.instructions.length,
      instructions,
    };
  }

  function isOutcomeStatus(value: unknown): value is OutcomeStatus {
    return (
      value === 'pending' ||
      value === 'approved' ||
      value === 'approved-with-feedback' ||
      value === 'rejected'
    );
  }

  function toProjectOutcomeRecord(value: unknown): ProjectOutcomeRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as {
      id?: unknown;
      passId?: unknown;
      timestamp?: unknown;
      status?: unknown;
      project?: unknown;
      summary?: unknown;
      feedback?: unknown;
      changedFiles?: unknown;
      writebacks?: unknown;
    };

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.passId !== 'string' ||
      typeof candidate.timestamp !== 'string' ||
      !isOutcomeStatus(candidate.status)
    ) {
      return null;
    }

    const changedFiles = Array.isArray(candidate.changedFiles)
      ? candidate.changedFiles.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const writebacks = Array.isArray(candidate.writebacks) ? candidate.writebacks : [];

    return {
      id: candidate.id,
      passId: candidate.passId,
      timestamp: candidate.timestamp,
      status: candidate.status,
      project: typeof candidate.project === 'string' ? candidate.project : undefined,
      summary: typeof candidate.summary === 'string' ? candidate.summary : undefined,
      feedback: typeof candidate.feedback === 'string' ? candidate.feedback : undefined,
      changedFileCount: changedFiles.length,
      writebackCount: writebacks.length,
    };
  }

  async function listProjectPassRecords(passesDir: string): Promise<ProjectPassRecord[]> {
    if (!(await pathExists(passesDir))) {
      return [];
    }

    const entries = await fs.readdir(passesDir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          try {
            const raw = await fs.readFile(path.join(passesDir, entry.name), 'utf8');
            return toProjectPassRecord(JSON.parse(raw));
          } catch {
            return null;
          }
        })
    );

    return records
      .filter((record): record is ProjectPassRecord => record !== null)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  }

  async function listProjectOutcomeRecords(outcomesDir: string): Promise<ProjectOutcomeRecord[]> {
    if (!(await pathExists(outcomesDir))) {
      return [];
    }

    const entries = await fs.readdir(outcomesDir, { withFileTypes: true });
    const records = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          try {
            const raw = await fs.readFile(path.join(outcomesDir, entry.name), 'utf8');
            return toProjectOutcomeRecord(JSON.parse(raw));
          } catch {
            return null;
          }
        })
    );

    return records
      .filter((record): record is ProjectOutcomeRecord => record !== null)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  }

  async function listProjects(): Promise<ProjectSummary[]> {
    const projectsRoot = path.join(config.contextRoot, '_projects');
    if (!(await pathExists(projectsRoot))) {
      return [];
    }

    const rootPassesDir = path.join(config.contextRoot, 'passes');
    const rootOutcomesDir = path.join(config.contextRoot, 'outcomes');
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });

    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const { briefPath, passesDir, outcomesDir } = getProjectPaths(entry.name);
          const brief = await readProjectBrief(briefPath);
          if (!brief) {
            return null;
          }

          const [projectPasses, rootPasses, projectOutcomes, rootOutcomes] = await Promise.all([
            listProjectPassRecords(passesDir),
            listProjectPassRecords(rootPassesDir),
            listProjectOutcomeRecords(outcomesDir),
            listProjectOutcomeRecords(rootOutcomesDir),
          ]);
          const scopedRootPasses = rootPasses.filter((pass) => !pass.project || pass.project === brief.name);
          const scopedRootOutcomes = rootOutcomes.filter(
            (outcome) => !outcome.project || outcome.project === brief.name
          );

          const allPasses = [...projectPasses];
          const seenPassIds = new Set(allPasses.map((p) => p.id));
          for (const pass of scopedRootPasses) {
            if (!seenPassIds.has(pass.id)) {
              seenPassIds.add(pass.id);
              allPasses.push(pass);
            }
          }

          const allOutcomes = [...projectOutcomes];
          const seenOutcomeIds = new Set(allOutcomes.map((o) => o.id));
          for (const outcome of scopedRootOutcomes) {
            if (!seenOutcomeIds.has(outcome.id)) {
              seenOutcomeIds.add(outcome.id);
              allOutcomes.push(outcome);
            }
          }

          const latestPass = allPasses[0]?.timestamp;
          const latestOutcome = allOutcomes[0]?.timestamp;
          const lastActivityAt = [brief.lastActivityAt, latestPass, latestOutcome]
            .filter((value): value is string => typeof value === 'string')
            .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? brief.lastActivityAt;

          return {
            name: brief.name,
            title: brief.title,
            lastActivityAt,
            passCount: allPasses.length,
            outcomeCount: allOutcomes.length,
            activeTypes: brief.activeTypes,
        } satisfies ProjectSummary;
        })
    );

    const projectSummaries = projects.filter(
      (project): project is NonNullable<typeof project> => project !== null
    );

    return projectSummaries.sort(
      (left, right) =>
        new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime()
    );
  }

  async function createProject(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    if (typeof request.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.name)) {
      throw new Error('Project name must be kebab-case');
    }

    if (typeof request.title !== 'string' || !request.title.trim()) {
      throw new Error('Project title is required');
    }

    const activeTypes = Array.isArray(request.activeTypes) ? request.activeTypes : [];
    if (!activeTypes.every((type) => isContextType(type))) {
      throw new Error('Project activeTypes must be valid context types');
    }

    const { projectDir, briefPath } = getProjectPaths(request.name);
    if (await pathExists(projectDir)) {
      throw new Error(`Project already exists: '${request.name}'`);
    }

    const timestamp = new Date().toISOString();
    const description = typeof request.description === 'string' ? request.description.trim() : '';
    const project: ProjectBrief = {
      name: request.name,
      title: request.title.trim(),
      description,
      createdAt: timestamp,
      lastActivityAt: timestamp,
      activeTypes,
    };

    const briefContent = [
      '---',
      `name: ${project.name}`,
      `title: ${JSON.stringify(project.title)}`,
      `description: ${JSON.stringify(project.description)}`,
      `createdAt: ${project.createdAt}`,
      `lastActivityAt: ${project.lastActivityAt}`,
      'activeTypes:',
      ...activeTypes.map((type) => `  - ${type}`),
      '---',
      '',
      `# ${project.title}`,
      '',
      project.description || 'Describe this project here.',
      '',
    ].join('\n');

    await ensureDir(projectDir);
    await ensureLearnedArtifacts(projectDir);
    await writeFileAtomic(briefPath, briefContent);

    return {
      project,
      path: projectDir,
    };
  }

  async function getProjectDetail(name: string): Promise<ProjectDetailResponse & {
    passes: ProjectPassRecord[];
    outcomes: ProjectOutcomeRecord[];
  }> {
    const { briefPath, passesDir, outcomesDir } = getProjectPaths(name);
    const brief = await readProjectBrief(briefPath);
    if (!brief) {
      throw new Error(`Project not found: '${name}'`);
    }

    const rootPassesDir = path.join(config.contextRoot, 'passes');
    const rootOutcomesDir = path.join(config.contextRoot, 'outcomes');
    const [projectPasses, rootPasses, projectOutcomes, rootOutcomes] = await Promise.all([
      listProjectPassRecords(passesDir),
      listProjectPassRecords(rootPassesDir),
      listProjectOutcomeRecords(outcomesDir),
      listProjectOutcomeRecords(rootOutcomesDir),
    ]);

    const scopedRootPasses = rootPasses.filter((pass) => !pass.project || pass.project === brief.name);
    const scopedRootOutcomes = rootOutcomes.filter(
      (outcome) => !outcome.project || outcome.project === brief.name
    );

    const allPasses = [...projectPasses];
    const seenPassIds = new Set(allPasses.map((p) => p.id));
    for (const pass of scopedRootPasses) {
      if (!seenPassIds.has(pass.id)) {
        seenPassIds.add(pass.id);
        allPasses.push(pass);
      }
    }

    const allOutcomes = [...projectOutcomes];
    const seenOutcomeIds = new Set(allOutcomes.map((o) => o.id));
    for (const outcome of scopedRootOutcomes) {
      if (!seenOutcomeIds.has(outcome.id)) {
        seenOutcomeIds.add(outcome.id);
        allOutcomes.push(outcome);
      }
    }

    allPasses.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
    allOutcomes.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

    return {
      brief,
      passCount: allPasses.length,
      outcomeCount: allOutcomes.length,
      passes: allPasses,
      outcomes: allOutcomes,
    };
  }

  // GET /api/corpus — overview of all context types
  app.get('/api/corpus', async (_req, res: express.Response<CorpusResponse | ServerErrorResponse>) => {
    try {
      let totalTokenEstimate = 0;
      const types: CorpusTypeEntry[] = [];

      for (const type of CONTEXT_TYPES) {
        const typeDir = path.join(config.contextRoot, type);
        const sourcesDir = path.join(typeDir, '_sources');
        const compiledPath = path.join(typeDir, 'compiled.md');

        // Auto-ingest any .md/.txt/.json files in the type root into _sources/
        const ingested = await autoIngestRootFiles(typeDir, sourcesDir);

        const sourceFiles = await listSourceFiles(type);

        // If we ingested new files and there are sources but no compiled file, auto-compile
        if (ingested > 0 && sourceFiles.length > 0 && !(await pathExists(compiledPath))) {
          await compileSourcesForType(type);
        }

        const compiled = await readCompiledFile(type);

        const tokenEstimate = compiled?.meta.totalTokenEstimate ??
          sourceFiles.reduce((sum, s) => sum + estimateTokens(s.preview), 0);
        totalTokenEstimate += tokenEstimate;

        types.push({
          type,
          exists: compiled !== null,
          meta: compiled?.meta ?? null,
          sourceCount: sourceFiles.length,
          priority: compiled?.meta.priority ?? DEFAULT_PRIORITIES[type],
        });
      }

      // Auto-generate brief.md if it doesn't exist and we have any sources
      const briefPath = path.join(config.contextRoot, 'brief.md');
      if (!(await pathExists(briefPath))) {
        const hasAnySources = types.some((t) => t.sourceCount > 0);
        if (hasAnySources) {
          await autoGenerateBrief(types);
        }
      }

      res.json({
        contextRoot: config.contextRoot,
        project: config.projectName,
        types,
        totalTokenEstimate,
      });
    } catch (error) {
      console.error('Corpus overview failed:', error);
      res.status(500).json({ error: 'Failed to read corpus' });
    }
  });

  app.get('/api/corpus/brief', async (_req, res) => {
    try {
      res.json(await readProductBrief());
    } catch (error) {
      console.error('Get product brief failed:', error);
      res.status(500).json({ error: 'Failed to read product brief' });
    }
  });

  app.put('/api/corpus/brief', async (req, res) => {
    const { content } = req.body as { content?: string };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Request body must include "content" (string)' });
      return;
    }

    try {
      await updateProductBrief(content);
      res.json({ ok: true });
    } catch (error) {
      console.error('Update product brief failed:', error);
      res.status(500).json({ error: 'Failed to update product brief' });
    }
  });

  app.post('/api/corpus/brief/regenerate', async (_req, res) => {
    try {
      // Gather compiled context summaries to include in the prompt
      const contextSummaries: string[] = [];
      for (const type of CONTEXT_TYPES) {
        const compiled = await readCompiledFile(type);
        if (compiled && compiled.content.trim()) {
          const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
          // Include up to ~1500 chars per type to keep the prompt manageable
          const excerpt = compiled.content.trim().slice(0, 1500);
          const truncated = excerpt.length < compiled.content.trim().length ? '...' : '';
          contextSummaries.push(`### ${label}\n${excerpt}${truncated}`);
        }
      }

      if (contextSummaries.length === 0) {
        res.status(400).json({ error: 'No compiled context to synthesize. Add sources first.' });
        return;
      }

      const briefPath = path.join(config.contextRoot, 'brief.md');

      const prompt = [
        `Synthesize a concise product brief for "${config.projectName}" from the context below.`,
        '',
        'Write a markdown document with:',
        '- A one-paragraph product summary',
        '- Key strategic decisions and positioning',
        '- Core technical constraints or architecture notes',
        '- Business context and success metrics',
        '',
        'Be concise — this is a brief, not a dump. Omit sections that have no relevant context.',
        '',
        '## Context',
        '',
        ...contextSummaries,
        '',
        '## Instructions',
        '',
        `Write the synthesized brief to: ${briefPath}`,
        `Include YAML frontmatter: title: "${config.projectName}" and a short description.`,
      ].join('\n');

      // Fire-and-forget dispatch to agent
      dispatchToAgent(prompt, config.contextRoot).catch((error) => {
        console.error('[contextual-server] Brief regeneration dispatch failed:', error);
      });

      res.json({ dispatched: true, message: 'Brief generation dispatched to agent' });
    } catch (error) {
      console.error('Regenerate brief failed:', error);
      res.status(500).json({ error: 'Failed to dispatch brief regeneration' });
    }
  });

  app.post('/api/corpus/import', async (req, res: express.Response<ImportResponse | ServerErrorResponse>) => {
    try {
      res.json(await importCorpus(req.body as ImportRequest));
    } catch (error) {
      console.error('Import corpus failed:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to import corpus',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Context Discovery: scan project for existing .md files
  // ---------------------------------------------------------------------------

  /**
   * Derive the project directory from the context root.
   * If contextRoot ends with .contextual, the project dir is the parent.
   */
  function getProjectDir(): string {
    const base = path.basename(config.contextRoot);
    return base === '.contextual'
      ? path.dirname(config.contextRoot)
      : config.contextRoot;
  }

  /** Directories to skip when scanning for markdown files */
  const SKIP_DIRS = new Set([
    'node_modules', '.git', '.next', '.nuxt', '.svelte-kit',
    'dist', 'build', 'out', '.contextual', '.cache',
    'coverage', '.turbo', '.vercel', '__pycache__',
  ]);

  /** Heuristic: suggest a context type based on file path and content */
  function suggestContextType(relativePath: string, content: string): ContextType | null {
    const lowerPath = relativePath.toLowerCase();
    const lowerContent = content.slice(0, 2000).toLowerCase();

    // Path-based heuristics
    if (/research|user[-_]?interview|usability|finding/i.test(lowerPath)) return 'research';
    if (/design[-_]?system|component|pattern|token|style[-_]?guide/i.test(lowerPath)) return 'design-system';
    if (/strateg|vision|roadmap|requirement|goal|prd|brief/i.test(lowerPath)) return 'strategy';
    if (/stakeholder|feedback|meeting|decision|review/i.test(lowerPath)) return 'stakeholders';
    if (/taste|brand|inspiration|aesthetic|anti[-_]?pattern/i.test(lowerPath)) return 'taste';
    if (/technic|architect|api|infra|schema|constraint|spec/i.test(lowerPath)) return 'technical';
    if (/business|revenue|model|pricing|market|competitor/i.test(lowerPath)) return 'business';

    // Content-based heuristics (check headings and keywords)
    if (/user (research|interview|testing)|pain point|usability/i.test(lowerContent)) return 'research';
    if (/component|design token|pattern library|style guide/i.test(lowerContent)) return 'design-system';
    if (/product strategy|success metric|requirement|objective|okr/i.test(lowerContent)) return 'strategy';
    if (/stakeholder|feedback|decision log|meeting note/i.test(lowerContent)) return 'stakeholders';
    if (/brand (guid|voice|feel)|inspiration|moodboard/i.test(lowerContent)) return 'taste';
    if (/architect|api (design|spec)|database|infrastruc|technical constraint/i.test(lowerContent)) return 'technical';
    if (/business model|revenue|pricing|market analysis|competitor/i.test(lowerContent)) return 'business';

    return null;
  }

  /** Recursively scan a directory for .md files */
  async function scanForMarkdown(
    dir: string,
    projectDir: string,
    results: DiscoveredFile[],
    maxFiles: number = 200,
  ): Promise<void> {
    if (results.length >= maxFiles) return;

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Permission denied or similar — skip
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) return;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        await scanForMarkdown(path.join(dir, entry.name), projectDir, results, maxFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'package.md') {
        const filePath = path.join(dir, entry.name);
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf8');
          const relativePath = path.relative(projectDir, filePath);

          results.push({
            relativePath,
            filename: entry.name,
            preview: content.slice(0, 500),
            size: stat.size,
            suggestedType: suggestContextType(relativePath, content),
          });
        } catch {
          // Can't read — skip
        }
      }
    }
  }

  app.get('/api/discover', async (_req, res: express.Response<DiscoverResponse | ServerErrorResponse>) => {
    try {
      const projectDir = getProjectDir();
      const files: DiscoveredFile[] = [];
      await scanForMarkdown(projectDir, projectDir, files);

      // Sort: files with suggested types first, then alphabetically
      files.sort((a, b) => {
        if (a.suggestedType && !b.suggestedType) return -1;
        if (!a.suggestedType && b.suggestedType) return 1;
        return a.relativePath.localeCompare(b.relativePath);
      });

      res.json({ projectDir, files });
    } catch (error) {
      console.error('Discover scan failed:', error);
      res.status(500).json({ error: 'Failed to scan project directory' });
    }
  });

  app.post('/api/discover/import', async (req, res: express.Response<DiscoverImportResponse | ServerErrorResponse>) => {
    try {
      const body = req.body as DiscoverImportRequest;
      if (!Array.isArray(body.files) || body.files.length === 0) {
        res.status(400).json({ error: 'Request must include a non-empty "files" array' });
        return;
      }

      const projectDir = getProjectDir();
      const results: DiscoverImportResponse['results'] = [];

      for (const file of body.files) {
        if (!isContextType(file.type)) {
          continue; // Skip invalid types
        }

        const sourcePath = path.resolve(projectDir, file.relativePath);
        // Security: ensure the file is inside the project directory
        if (!sourcePath.startsWith(projectDir + path.sep)) {
          continue;
        }

        const content = await fs.readFile(sourcePath, 'utf8');
        const filename = path.basename(file.relativePath);

        const sourcesDir = path.join(config.contextRoot, file.type, '_sources');
        await fs.mkdir(sourcesDir, { recursive: true });

        const destPath = path.join(sourcesDir, sanitizeFilename(filename));
        await fs.writeFile(destPath, content, 'utf8');

        results.push({
          relativePath: file.relativePath,
          type: file.type,
          filename,
        });
      }

      // Auto-compile affected types and generate brief
      const affectedTypes = [...new Set(results.map((r) => r.type))];
      for (const type of affectedTypes) {
        try {
          await compileSourcesForType(type as ContextType);
        } catch (err) {
          console.error(`[contextual-server] Auto-compile failed for ${type}:`, err);
        }
      }

      // Auto-generate brief after discover import (always regenerate)
      if (results.length > 0) {
        try {
          const types: CorpusTypeEntry[] = [];
          for (const type of CONTEXT_TYPES) {
            const sources = await listSourceFiles(type);
            types.push({
              type,
              meta: null,
              priority: 'reference' as ContextPriority,
              exists: sources.length > 0,
              sourceCount: sources.length,
            });
          }
          await autoGenerateBrief(types);
        } catch (err) {
          console.error('[contextual-server] Auto-generate brief failed:', err);
        }
      }

      res.json({ imported: results.length, results });
    } catch (error) {
      console.error('Discover import failed:', error);
      res.status(500).json({ error: 'Failed to import discovered files' });
    }
  });

  app.get('/api/corpus/passes', async (_req, res) => {
    try {
      const passes = await listProjectPassRecords(path.join(config.contextRoot, 'passes'));
      res.json({ passes, passCount: passes.length });
    } catch (error) {
      console.error('List corpus passes failed:', error);
      res.status(500).json({ error: 'Failed to list passes' });
    }
  });

  app.get('/api/corpus/outcomes', async (_req, res) => {
    try {
      const outcomes = await listProjectOutcomeRecords(path.join(config.contextRoot, 'outcomes'));
      res.json({ outcomes, outcomeCount: outcomes.length });
    } catch (error) {
      console.error('List corpus outcomes failed:', error);
      res.status(500).json({ error: 'Failed to list outcomes' });
    }
  });

  // GET /api/corpus/:type — get compiled file content and metadata
  app.get('/api/corpus/:type', async (req, res: express.Response<CompiledFileResponse | ServerErrorResponse>) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    try {
      const compiled = await readCompiledFile(type as ContextType);
      if (!compiled) {
        res.status(404).json({ error: `No compiled file for type: ${type}` });
        return;
      }
      res.json(compiled);
    } catch (error) {
      console.error(`Get compiled file failed for ${type}:`, error);
      res.status(500).json({ error: 'Failed to read compiled file' });
    }
  });

  app.get('/api/corpus/:type/sections/:index', async (req, res: express.Response<SectionResponse | ServerErrorResponse>) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    const sectionIndex = Number.parseInt(req.params.index, 10);
    if (!Number.isInteger(sectionIndex) || sectionIndex < 0) {
      res.status(400).json({ error: `Invalid section index: ${req.params.index}` });
      return;
    }

    try {
      res.json(await getSectionResponse(type, sectionIndex));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read section';
      console.error(`Get section failed for ${type}/${sectionIndex}:`, error);
      res.status(message.startsWith('No section') || message.startsWith('No compiled file') ? 404 : 500)
        .json({ error: message });
    }
  });

  // PUT /api/corpus/:type/compiled — update compiled file
  app.put('/api/corpus/:type/compiled', async (req, res) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    const { content } = req.body as { content?: string };
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'Request body must include "content" (string)' });
      return;
    }

    try {
      const typeDir = path.join(config.contextRoot, type);
      await fs.mkdir(typeDir, { recursive: true });
      const compiledPath = path.join(typeDir, 'compiled.md');
      await writeFileAtomic(compiledPath, content);
      res.json({ ok: true });
    } catch (error) {
      console.error(`Update compiled file failed for ${type}:`, error);
      res.status(500).json({ error: 'Failed to write compiled file' });
    }
  });

  // POST /api/corpus/:type/compile — auto-compile: merge all sources into compiled.md
  app.post('/api/corpus/:type/compile', async (req, res) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    try {
      const sources = await listSourceFiles(type as ContextType);
      if (sources.length === 0) {
        res.json({ ok: true, sourceCount: 0, message: 'No sources to compile' });
        return;
      }

      const typeDir = path.join(config.contextRoot, type);
      const sourcesDir = path.join(typeDir, '_sources');

      // Build compiled markdown from all source files
      const sections: string[] = [];
      const timestamp = new Date().toISOString();
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');

      sections.push('---');
      sections.push(`type: ${type}`);
      sections.push(`title: ${typeLabel} Context`);
      sections.push(`lastCompiled: "${timestamp}"`);
      sections.push(`sourceCount: ${sources.length}`);
      sections.push('---');
      sections.push('');
      sections.push(`# ${typeLabel} Context`);
      sections.push('');

      for (const source of sources) {
        const filePath = path.join(sourcesDir, source.filename);
        try {
          let raw = await fs.readFile(filePath, 'utf-8');

          // Strip HTML comment labels (e.g., <!-- label -->)
          raw = raw.replace(/^<!--\s*.*?\s*-->\s*\n*/m, '');

          const label = source.filename.replace(/\.(md|markdown|txt|json)$/, '');
          sections.push(`## ${label}`);
          sections.push('');
          sections.push(raw.trim());
          sections.push('');
        } catch { /* skip unreadable files */ }
      }

      const compiledContent = sections.join('\n');
      const compiledPath = path.join(typeDir, 'compiled.md');
      await fs.writeFile(compiledPath, compiledContent, 'utf-8');

      res.json({ ok: true, sourceCount: sources.length, compiledPath });
    } catch (error) {
      console.error(`Compile failed for ${type}:`, error);
      res.status(500).json({ error: 'Failed to compile sources' });
    }
  });

  // GET /api/corpus/:type/sources — list source files for a type
  app.get('/api/corpus/:type/sources', async (req, res: express.Response<SourceListResponse | ServerErrorResponse>) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    try {
      const sources = await listSourceFiles(type as ContextType);
      res.json({ type: type as ContextType, sources });
    } catch (error) {
      console.error(`List sources failed for ${type}:`, error);
      res.status(500).json({ error: 'Failed to list sources' });
    }
  });

  app.get('/api/corpus/:type/sources/:filename', async (req, res: express.Response<SourceContentResponse | ServerErrorResponse>) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    try {
      res.json(await getSourceContent(type, req.params.filename));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read source file';
      console.error(`Read source failed for ${type}/${req.params.filename}:`, error);
      res.status(message.startsWith('Source file not found') ? 404 : 400).json({ error: message });
    }
  });

  // POST /api/corpus/:type/sources — add a new source file
  app.post('/api/corpus/:type/sources', async (req, res: express.Response<AddSourceResponse | ServerErrorResponse>) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    const body = req.body as Partial<AddSourceRequest>;
    if (typeof body.content !== 'string' || !body.content.trim()) {
      res.status(400).json({ error: 'Request body must include "content" (non-empty string)' });
      return;
    }

    try {
      const sourcesDir = path.join(config.contextRoot, type, '_sources');
      await fs.mkdir(sourcesDir, { recursive: true });

      // Generate filename: paste-{timestamp}.md or use provided filename
      const filename = body.filename
        ? sanitizeFilename(body.filename)
        : `paste-${new Date().toISOString().replace(/:/g, '-')}.md`;
      const filePath = path.join(sourcesDir, filename);

      // Build content with optional label
      let fileContent = body.content.trim();
      if (body.label) {
        fileContent = `<!-- label: ${body.label} -->\n\n${fileContent}`;
      }

      await fs.writeFile(filePath, fileContent, 'utf-8');

      res.status(201).json({
        filename,
        path: filePath,
      });
    } catch (error) {
      console.error(`Add source failed for ${type}:`, error);
      res.status(500).json({ error: 'Failed to add source' });
    }
  });

  app.put('/api/corpus/:type/priority', async (req, res) => {
    const type = req.params.type;
    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    const { priority } = req.body as { priority?: unknown };
    if (priority !== 'system' && priority !== 'project' && priority !== 'reference') {
      res.status(400).json({ error: 'Request body must include valid "priority"' });
      return;
    }

    try {
      res.json({ ok: true, priority: await updateCompiledPriority(type, priority) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update priority';
      console.error(`Update priority failed for ${type}:`, error);
      res.status(message.startsWith('No compiled file') ? 404 : 500).json({ error: message });
    }
  });

  // DELETE /api/corpus/:type/sources/:filename — delete a source file
  app.delete('/api/corpus/:type/sources/:filename', async (req, res) => {
    const type = req.params.type;
    const filename = req.params.filename;

    if (!isContextType(type)) {
      res.status(400).json({ error: `Invalid context type: ${type}` });
      return;
    }

    // Security: prevent path traversal
    if (filename.includes('/') || filename.includes('..')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    try {
      const filePath = path.join(config.contextRoot, type, '_sources', filename);
      await fs.unlink(filePath);
      res.json({ ok: true, deleted: filename });
    } catch (error) {
      console.error(`Delete source failed for ${type}/${filename}:`, error);
      res.status(404).json({ error: `Source file not found: ${filename}` });
    }
  });

  app.get('/api/projects', async (_req, res: express.Response<ProjectListResponse | ServerErrorResponse>) => {
    try {
      res.json({ projects: await listProjects() });
    } catch (error) {
      console.error('List projects failed:', error);
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  app.post('/api/projects', async (req, res: express.Response<CreateProjectResponse | ServerErrorResponse>) => {
    try {
      res.status(201).json(await createProject(req.body as CreateProjectRequest));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project';
      console.error('Create project failed:', error);
      res.status(message.startsWith('Project already exists') ? 409 : 400).json({ error: message });
    }
  });

  app.get('/api/projects/:name', async (req, res: express.Response<ProjectDetailResponse | ServerErrorResponse>) => {
    try {
      res.json(await getProjectDetail(req.params.name));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read project';
      console.error(`Get project failed for ${req.params.name}:`, error);
      res.status(message.startsWith('Project not found') ? 404 : 500).json({ error: message });
    }
  });

  // ---------------------------------------------------------------------------

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
      !Array.isArray(pass.instructions)
    ) {
      res.status(400).json({ error: 'Pass must include id, timestamp, and instructions[]' });
      return;
    }

    try {
      const normalizedPass = normalizePass(pass as Pass, config.projectName);

      const filePath = await passStore.createPass(normalizedPass);
      const passPathForPrompt = filePath;

      // Fire-and-forget: dispatch to agent (don't block the HTTP response)
      dispatchToAgent(
        buildTerminalDispatchPrompt(passPathForPrompt, normalizedPass, config),
        config.contextRoot,
      ).catch((error) => {
        console.error('[contextual-server] Agent dispatch failed:', error);
      });

      res.status(201).json({
        id: normalizedPass.id,
        path: filePath,
        timestamp: normalizedPass.timestamp,
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

  app.get('/passes/:id/outcome', async (req, res: express.Response<PassOutcome | ServerErrorResponse>) => {
    try {
      const outcome = await outcomeStore.getLatestOutcomeForPass(req.params.id);
      if (!outcome) {
        res.status(404).json({ error: `No outcome found for pass: ${req.params.id}` });
        return;
      }
      res.json(outcome);
    } catch (error) {
      console.error('Get latest outcome failed:', error);
      res.status(500).json({ error: 'Failed to read latest pass outcome' });
    }
  });

  // ---------------------------------------------------------------------------
  // Outcome Endpoints
  // ---------------------------------------------------------------------------

  app.post('/outcomes', async (req, res: express.Response<CreateOutcomeResponse | ServerErrorResponse>) => {
    if (!isCreateOutcomeRequest(req.body)) {
      res.status(400).json({ error: 'Request body must include a valid "outcome" object' });
      return;
    }

    try {
      const normalizedOutcome = normalizeOutcome(
        req.body.outcome as PassOutcome,
        config.projectName,
      );

      const filePath = await outcomeStore.createOutcome(normalizedOutcome);
      res.status(201).json({
        id: normalizedOutcome.id,
        path: filePath,
        timestamp: normalizedOutcome.timestamp,
      });
    } catch (error) {
      console.error('Create outcome failed:', error);
      res.status(500).json({ error: 'Failed to persist outcome' });
    }
  });

  app.get('/outcomes', async (_req, res: express.Response<OutcomeListResponse | ServerErrorResponse>) => {
    try {
      const outcomes = await outcomeStore.listOutcomeSummaries();
      res.json({ outcomes });
    } catch (error) {
      console.error('List outcomes failed:', error);
      res.status(500).json({ error: 'Failed to list outcomes' });
    }
  });

  app.get('/outcomes/:id', async (req, res: express.Response<PassOutcome | ServerErrorResponse>) => {
    try {
      const outcome = await outcomeStore.getOutcome(req.params.id);
      if (!outcome) {
        res.status(404).json({ error: `Outcome not found: ${req.params.id}` });
        return;
      }
      res.json(outcome);
    } catch (error) {
      console.error('Get outcome failed:', error);
      res.status(500).json({ error: 'Failed to read outcome' });
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

    // Optional: comma-separated ancestor selectors from the client
    const ancestorsParam = req.query.ancestors;
    const ancestorSelectors: string[] = typeof ancestorsParam === 'string' && ancestorsParam.trim()
      ? ancestorsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    try {
      const [passes, contextHistory] = await Promise.all([
        passStore.getPassesForElement(selector),
        passStore.getContextHistoryForElement(selector),
      ]);

      // Find inherited passes from ancestor selectors (excluding already-matched pass IDs)
      const directPassIds = new Set(passes.map((p) => p.passId));
      const inheritedPasses = ancestorSelectors.length > 0
        ? await passStore.getInheritedPasses(ancestorSelectors, directPassIds)
        : [];

      res.json({
        selector,
        passes,
        inheritedPasses,
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

  if (serveUi) {
    let cachedUiIndexHtml: string | null = null;

    const loadUiIndexHtml = async (): Promise<string> => {
      if (cachedUiIndexHtml !== null) {
        return cachedUiIndexHtml;
      }

      const html = await fs.readFile(uiIndexPath, 'utf8');
      cachedUiIndexHtml = injectRuntimeApiBase(html);
      return cachedUiIndexHtml;
    };

    app.use(express.static(uiDir, { index: false }));

    app.get(/^\/(.*)$/, async (req, res, next) => {
      if (req.method !== 'GET') {
        next();
        return;
      }

      if (isReservedServerPath(req.path) || path.extname(req.path)) {
        next();
        return;
      }

      try {
        const html = await loadUiIndexHtml();
        res.type('html').send(html);
      } catch (error) {
        console.error('Context manager UI unavailable:', error);
        res.status(500).send('Context manager UI is not available. Rebuild the server package.');
      }
    });
  }

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
