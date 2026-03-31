import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Connect, Plugin } from 'vite';
import type {
  AddSourceRequest,
  CompiledFileMeta,
  ContextType,
  CorpusResponse,
  CorpusTypeEntry,
  ImportRequest,
  ImportResponse,
  SectionMeta,
  SectionResponse,
  SourceContentResponse,
  SourceFile,
  SourceListResponse,
  UpdateCompiledRequest,
} from '@contextual/shared';
import { CONTEXT_TYPES, isContextType } from '@contextual/shared';

const SOURCE_EXTENSIONS = new Set(['.md', '.txt', '.json']);

interface RuntimeConfig {
  contextRoot: string;
}

interface ServerErrorResponse {
  error: string;
}

interface ParsedCompiledDocument {
  meta: CompiledFileMeta;
  body: string;
  bodyLines: string[];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

function parseConfig(url: URL): RuntimeConfig {
  return {
    contextRoot: path.resolve(
      url.searchParams.get('contextRoot') ||
        process.env.CONTEXTUAL_CONTEXT_ROOT ||
        path.join(process.cwd(), 'context')
    ),
  };
}

function parseScalar(raw: string): string | number {
  const trimmed = raw.trim();
  const unquoted = trimmed.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  if (/^-?\d+$/.test(unquoted)) {
    return Number(unquoted);
  }
  return unquoted;
}

function assignSectionField(section: Partial<SectionMeta>, line: string): void {
  const match = /^([A-Za-z][\w]*):\s*(.+?)\s*$/.exec(line);
  if (!match) {
    return;
  }

  const [, key, rawValue] = match;
  const parsedValue = parseScalar(rawValue);

  switch (key) {
    case 'title':
      if (typeof parsedValue === 'string') {
        section.title = parsedValue;
      }
      break;
    case 'startLine':
      if (typeof parsedValue === 'number') {
        section.startLine = parsedValue;
      }
      break;
    case 'endLine':
      if (typeof parsedValue === 'number') {
        section.endLine = parsedValue;
      }
      break;
    case 'tokenEstimate':
      if (typeof parsedValue === 'number') {
        section.tokenEstimate = parsedValue;
      }
      break;
  }
}

function splitFrontmatter(content: string): {
  frontmatterLines: string[];
  body: string;
  bodyLines: string[];
} | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return null;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closingIndex === -1) {
    return null;
  }

  const bodyLines = lines.slice(closingIndex + 1);
  return {
    frontmatterLines: lines.slice(1, closingIndex),
    body: bodyLines.join('\n'),
    bodyLines,
  };
}

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return Math.ceil(trimmed.split(/\s+/).length * 1.3);
}

export function parseFrontmatter(content: string): CompiledFileMeta | null {
  const extracted = splitFrontmatter(content);
  if (!extracted) {
    return null;
  }

  let type: ContextType | null = null;
  let title = '';
  let lastCompiled = '';
  let sourceCount = 0;
  let totalTokenEstimate = 0;
  const sections: SectionMeta[] = [];

  for (let index = 0; index < extracted.frontmatterLines.length; index += 1) {
    const line = extracted.frontmatterLines[index]!;

    if (!line.trim()) {
      continue;
    }

    if (/^sections:\s*$/.test(line)) {
      index += 1;
      while (index < extracted.frontmatterLines.length) {
        const currentLine = extracted.frontmatterLines[index]!;

        if (!currentLine.trim()) {
          index += 1;
          continue;
        }

        if (!currentLine.startsWith('  -')) {
          index -= 1;
          break;
        }

        const section: Partial<SectionMeta> = {};
        const inlineFields = currentLine.replace(/^  -\s*/, '').trim();
        if (inlineFields) {
          assignSectionField(section, inlineFields);
        }

        index += 1;
        while (
          index < extracted.frontmatterLines.length &&
          /^ {4}\S/.test(extracted.frontmatterLines[index]!)
        ) {
          assignSectionField(section, extracted.frontmatterLines[index]!.trim());
          index += 1;
        }
        index -= 1;

        if (
          typeof section.title === 'string' &&
          typeof section.startLine === 'number' &&
          typeof section.endLine === 'number'
        ) {
          sections.push({
            title: section.title,
            startLine: section.startLine,
            endLine: section.endLine,
            tokenEstimate:
              typeof section.tokenEstimate === 'number'
                ? section.tokenEstimate
                : estimateTokens(section.title),
          });
        }
      }

      continue;
    }

    const match = /^([A-Za-z][\w]*):\s*(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const parsedValue = parseScalar(rawValue);

    switch (key) {
      case 'type':
        if (typeof parsedValue === 'string' && isContextType(parsedValue)) {
          type = parsedValue;
        }
        break;
      case 'title':
        if (typeof parsedValue === 'string') {
          title = parsedValue;
        }
        break;
      case 'lastCompiled':
        if (typeof parsedValue === 'string') {
          lastCompiled = parsedValue;
        }
        break;
      case 'sourceCount':
        if (typeof parsedValue === 'number') {
          sourceCount = parsedValue;
        }
        break;
      case 'totalTokenEstimate':
        if (typeof parsedValue === 'number') {
          totalTokenEstimate = parsedValue;
        }
        break;
    }
  }

  if (!type || !title || !lastCompiled) {
    return null;
  }

  return {
    type,
    title,
    lastCompiled,
    sourceCount,
    sections,
    totalTokenEstimate:
      totalTokenEstimate || sections.reduce((sum, section) => sum + section.tokenEstimate, 0),
  };
}

function getTypePaths(contextRoot: string, type: ContextType) {
  const typeDir = path.join(contextRoot, type);
  return {
    typeDir,
    compiledPath: path.join(typeDir, 'compiled.md'),
    sourcesDir: path.join(typeDir, '_sources'),
  };
}

function previewText(content: string, maxLength = 400): string {
  return content.slice(0, maxLength);
}

async function listSourceFilenames(sourcesDir: string): Promise<string[]> {
  if (!(await exists(sourcesDir))) {
    return [];
  }

  const entries = await fs.readdir(sourcesDir, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function sanitizeFilename(filename: string): string {
  const decoded = decodeURIComponent(filename);
  const basename = path.basename(decoded);
  if (!basename || basename === '.' || basename === '..') {
    throw new Error(`Invalid filename: "${filename}"`);
  }
  return basename;
}

async function readCompiledDocument(compiledPath: string): Promise<ParsedCompiledDocument | null> {
  if (!(await exists(compiledPath))) {
    return null;
  }

  const raw = await fs.readFile(compiledPath, 'utf8');
  const extracted = splitFrontmatter(raw);
  const meta = parseFrontmatter(raw);

  if (!extracted || !meta) {
    return null;
  }

  return {
    meta,
    body: extracted.body,
    bodyLines: extracted.bodyLines,
  };
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${Date.now()}`;
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function buildCorpusResponse(config: RuntimeConfig): Promise<CorpusResponse> {
  const types: CorpusTypeEntry[] = await Promise.all(
    CONTEXT_TYPES.map(async (type) => {
      const { compiledPath, sourcesDir } = getTypePaths(config.contextRoot, type);
      await ensureDir(sourcesDir);

      const sourceCount = (await listSourceFilenames(sourcesDir)).length;
      const compiled = await readCompiledDocument(compiledPath);

      return {
        type,
        exists: await exists(compiledPath),
        meta: compiled?.meta ?? null,
        sourceCount,
      };
    })
  );

  return {
    contextRoot: config.contextRoot,
    types,
    totalTokenEstimate: types.reduce(
      (sum, entry) => sum + (entry.meta?.totalTokenEstimate ?? 0),
      0
    ),
  };
}

async function getCompiledFileResponse(
  config: RuntimeConfig,
  type: ContextType
): Promise<{ meta: CompiledFileMeta; content: string }> {
  const { compiledPath } = getTypePaths(config.contextRoot, type);
  if (!(await exists(compiledPath))) {
    throw new Error(`No compiled file for type '${type}'`);
  }

  const document = await readCompiledDocument(compiledPath);
  if (!document) {
    throw new Error(`Compiled file for type '${type}' has invalid frontmatter`);
  }

  return {
    meta: document.meta,
    content: document.body,
  };
}

async function getSectionResponse(
  config: RuntimeConfig,
  type: ContextType,
  index: number
): Promise<SectionResponse> {
  const { compiledPath } = getTypePaths(config.contextRoot, type);
  if (!(await exists(compiledPath))) {
    throw new Error(`No compiled file for type '${type}'`);
  }

  const document = await readCompiledDocument(compiledPath);
  if (!document) {
    throw new Error(`Compiled file for type '${type}' has invalid frontmatter`);
  }

  const section = document.meta.sections[index];
  if (!section) {
    throw new Error(`No section ${index} for type '${type}'`);
  }

  const content = document.bodyLines
    .slice(section.startLine - 1, section.endLine)
    .join('\n');

  return {
    section,
    content,
  };
}

async function getSourceListResponse(
  config: RuntimeConfig,
  type: ContextType
): Promise<SourceListResponse> {
  const { sourcesDir } = getTypePaths(config.contextRoot, type);
  await ensureDir(sourcesDir);

  const filenames = await listSourceFilenames(sourcesDir);
  const sources: SourceFile[] = await Promise.all(
    filenames.map(async (filename) => {
      const filePath = path.join(sourcesDir, filename);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');

      return {
        filename,
        size: stat.size,
        preview: previewText(content),
        addedAt: stat.mtime.toISOString(),
      };
    })
  );

  return { type, sources };
}

async function getSourceContentResponse(
  config: RuntimeConfig,
  type: ContextType,
  filename: string
): Promise<SourceContentResponse> {
  const safeFilename = sanitizeFilename(filename);
  const { sourcesDir } = getTypePaths(config.contextRoot, type);
  const filePath = path.join(sourcesDir, safeFilename);

  if (!(await exists(filePath))) {
    throw new Error(`Source file not found: '${safeFilename}'`);
  }

  return {
    filename: safeFilename,
    content: await fs.readFile(filePath, 'utf8'),
  };
}

async function createSourceFile(
  config: RuntimeConfig,
  type: ContextType,
  request: AddSourceRequest
): Promise<{ filename: string; path: string }> {
  if (typeof request.content !== 'string' || !request.content.trim()) {
    throw new Error('Request body must include non-empty "content"');
  }

  const { typeDir, sourcesDir } = getTypePaths(config.contextRoot, type);
  await ensureDir(typeDir);
  await ensureDir(sourcesDir);

  const filename = request.filename?.trim()
    ? sanitizeFilename(request.filename)
    : `paste-${Date.now()}.md`;
  const filePath = path.join(sourcesDir, filename);
  const body = request.label
    ? `<!-- label: ${request.label} -->\n\n${request.content}`
    : request.content;

  await writeFileAtomic(filePath, body);

  return {
    filename,
    path: filePath,
  };
}

async function deleteSourceFile(
  config: RuntimeConfig,
  type: ContextType,
  filename: string
): Promise<void> {
  const safeFilename = sanitizeFilename(filename);
  const { sourcesDir } = getTypePaths(config.contextRoot, type);
  const filePath = path.join(sourcesDir, safeFilename);

  if (!(await exists(filePath))) {
    throw new Error(`Source file not found: '${safeFilename}'`);
  }

  await fs.unlink(filePath);
}

async function updateCompiledFile(
  config: RuntimeConfig,
  type: ContextType,
  request: UpdateCompiledRequest
): Promise<void> {
  if (typeof request.content !== 'string') {
    throw new Error('Request body must include "content"');
  }

  const { typeDir, compiledPath } = getTypePaths(config.contextRoot, type);
  await ensureDir(typeDir);
  await writeFileAtomic(compiledPath, request.content);
}

async function importCorpus(
  config: RuntimeConfig,
  request: ImportRequest
): Promise<ImportResponse> {
  if (!request.sourcePath || !Array.isArray(request.types)) {
    throw new Error('Request body must include "sourcePath" and "types"');
  }

  const sourceRoot = path.resolve(request.sourcePath);
  const imported: ImportResponse['imported'] = [];

  for (const type of request.types) {
    if (!isContextType(type)) {
      throw new Error(`Invalid context type in import: '${type}'`);
    }

    const sourcePaths = getTypePaths(sourceRoot, type);
    const destinationPaths = getTypePaths(config.contextRoot, type);
    const copiedFiles: string[] = [];

    await ensureDir(destinationPaths.typeDir);
    await ensureDir(destinationPaths.sourcesDir);

    if (await exists(sourcePaths.compiledPath)) {
      await fs.copyFile(sourcePaths.compiledPath, destinationPaths.compiledPath);
      copiedFiles.push('compiled.md');
    }

    const sourceFiles = await listSourceFilenames(sourcePaths.sourcesDir);
    for (const filename of sourceFiles) {
      const fromPath = path.join(sourcePaths.sourcesDir, filename);
      const toPath = path.join(destinationPaths.sourcesDir, filename);
      await fs.copyFile(fromPath, toPath);
      copiedFiles.push(`_sources/${filename}`);
    }

    imported.push({ type, files: copiedFiles });
  }

  return { imported };
}

async function readJson(req: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function sendJson(res: Connect.ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sendError(
  res: Connect.ServerResponse,
  statusCode: number,
  message: string
): void {
  sendJson(res, statusCode, { error: message } satisfies ServerErrorResponse);
}

export function localFilesPlugin(): Plugin {
  return {
    name: 'context-manager-local-files',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const config = parseConfig(url);
        const parts = url.pathname.split('/').filter(Boolean);

        if (parts[0] !== 'api' || parts[1] !== 'corpus') {
          next();
          return;
        }

        try {
          if (req.method === 'GET' && parts.length === 2) {
            sendJson(res, 200, await buildCorpusResponse(config));
            return;
          }

          if (req.method === 'POST' && parts.length === 3 && parts[2] === 'import') {
            const body = (await readJson(req)) as ImportRequest;
            sendJson(res, 200, await importCorpus(config, body));
            return;
          }

          const rawType = parts[2];
          if (!rawType || !isContextType(rawType)) {
            sendError(res, 400, `Invalid context type: '${rawType ?? ''}'`);
            return;
          }

          const type = rawType;

          if (req.method === 'GET' && parts.length === 3) {
            sendJson(res, 200, await getCompiledFileResponse(config, type));
            return;
          }

          if (req.method === 'GET' && parts.length === 5 && parts[3] === 'sections') {
            const sectionIndex = Number.parseInt(parts[4] ?? '', 10);
            if (!Number.isInteger(sectionIndex) || sectionIndex < 0) {
              sendError(res, 400, `Invalid section index: '${parts[4] ?? ''}'`);
              return;
            }

            try {
              sendJson(res, 200, await getSectionResponse(config, type, sectionIndex));
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Failed to read section';
              const statusCode = message.startsWith('No section') ? 404 : 500;
              sendError(res, statusCode, message);
            }
            return;
          }

          if (req.method === 'GET' && parts.length === 4 && parts[3] === 'sources') {
            sendJson(res, 200, await getSourceListResponse(config, type));
            return;
          }

          if (req.method === 'GET' && parts.length === 5 && parts[3] === 'sources') {
            try {
              sendJson(
                res,
                200,
                await getSourceContentResponse(config, type, parts[4] ?? '')
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Failed to read source file';
              const statusCode = message.startsWith('Source file not found') ? 404 : 500;
              sendError(res, statusCode, message);
            }
            return;
          }

          if (req.method === 'POST' && parts.length === 4 && parts[3] === 'sources') {
            const body = (await readJson(req)) as AddSourceRequest;
            try {
              sendJson(res, 201, await createSourceFile(config, type, body));
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Failed to write source file';
              sendError(res, 400, message);
            }
            return;
          }

          if (req.method === 'DELETE' && parts.length === 5 && parts[3] === 'sources') {
            try {
              await deleteSourceFile(config, type, parts[4] ?? '');
              sendJson(res, 200, { ok: true });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Failed to delete source file';
              const statusCode = message.startsWith('Source file not found') ? 404 : 400;
              sendError(res, statusCode, message);
            }
            return;
          }

          if (req.method === 'PUT' && parts.length === 4 && parts[3] === 'compiled') {
            const body = (await readJson(req)) as UpdateCompiledRequest;
            try {
              await updateCompiledFile(config, type, body);
              sendJson(res, 200, { ok: true });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Failed to update compiled file';
              sendError(res, 400, message);
            }
            return;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown server error';

          if (message.startsWith('No compiled file')) {
            sendError(res, 404, message);
            return;
          }

          sendError(res, 500, message);
          return;
        }

        next();
      });
    },
  };
}
