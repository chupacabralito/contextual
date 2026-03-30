import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Connect, Plugin } from 'vite';

type ContextType =
  | 'research'
  | 'taste'
  | 'strategy'
  | 'design-system'
  | 'stakeholders';

const CONTEXT_TYPES: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
];

interface RuntimeConfig {
  contextRoot: string;
  projectPath: string;
  previousProjectsPath: string;
}

function truncate(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isContextType(value: string): value is ContextType {
  return CONTEXT_TYPES.includes(value as ContextType);
}

async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursively(fullPath);
      }
      return [fullPath];
    })
  );
  return nested.flat();
}

function parseConfig(url: URL): RuntimeConfig {
  const contextRoot = path.resolve(
    url.searchParams.get('contextRoot') ||
      process.env.CONTEXTUAL_CONTEXT_ROOT ||
      path.join(process.cwd(), 'context-root')
  );
  const projectPath = path.resolve(
    url.searchParams.get('projectPath') ||
      process.env.CONTEXTUAL_PROJECT_PATH ||
      path.join(process.cwd(), 'project')
  );
  const previousProjectsPath = path.resolve(
    url.searchParams.get('previousProjectsPath') ||
      process.env.CONTEXTUAL_PREVIOUS_PROJECTS_PATH ||
      path.dirname(projectPath)
  );

  return {
    contextRoot,
    projectPath,
    previousProjectsPath,
  };
}

async function buildContextRootResponse(config: RuntimeConfig) {
  const groups = await Promise.all(
    CONTEXT_TYPES.map(async (type) => {
      const directory = path.join(config.contextRoot, type);
      if (!(await exists(directory))) {
        return {
          type,
          fileCount: 0,
          summary: 'No default files found.',
          files: [],
        };
      }

      const filePaths = (await listFilesRecursively(directory)).filter((filePath) =>
        ['.md', '.json', '.txt'].includes(path.extname(filePath).toLowerCase())
      );

      const files = await Promise.all(
        filePaths.map(async (filePath) => {
          const content = await fs.readFile(filePath, 'utf8');
          const relativePath = path.relative(config.contextRoot, filePath);
          return {
            relativePath,
            fileName: path.basename(filePath),
            summary: truncate(content, 90),
            preview: truncate(content, 260),
          };
        })
      );

      return {
        type,
        fileCount: files.length,
        summary:
          files.length === 0
            ? 'Folder is available but currently empty.'
            : `${files.length} file${files.length === 1 ? '' : 's'} ready to seed this project.`,
        files,
      };
    })
  );

  return {
    contextRoot: config.contextRoot,
    projectPath: config.projectPath,
    previousProjectsPath: config.previousProjectsPath,
    groups,
  };
}

async function buildPreviousProjectsResponse(config: RuntimeConfig) {
  if (!(await exists(config.previousProjectsPath))) {
    return { projects: [] };
  }

  const entries = await fs.readdir(config.previousProjectsPath, { withFileTypes: true });
  const projects = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const projectPath = path.join(config.previousProjectsPath, entry.name);
        const groups = await Promise.all(
          CONTEXT_TYPES.map(async (type) => {
            const directory = path.join(projectPath, type);
            if (!(await exists(directory))) {
              return { type, fileCount: 0, files: [] };
            }

            const files = (await listFilesRecursively(directory))
              .filter((filePath) => ['.md', '.json', '.txt'].includes(path.extname(filePath)))
              .map((filePath) => path.relative(directory, filePath));

            return { type, fileCount: files.length, files };
          })
        );

        const totalFiles = groups.reduce((sum, group) => sum + group.fileCount, 0);
        if (totalFiles === 0) return null;

        return {
          name: entry.name,
          path: projectPath,
          groups,
        };
      })
  );

  return { projects: projects.filter(Boolean) };
}

async function copyImportedFiles(
  projectPath: string,
  previousProjectsPath: string,
  imported: { projectName: string; files: string[] } | undefined
): Promise<string[]> {
  if (!imported) return [];

  const sourceProjectPath = path.join(previousProjectsPath, imported.projectName);
  const copiedFiles: string[] = [];

  for (const relativeFile of imported.files) {
    const segments = relativeFile.split('/');
    if (!segments[0] || !isContextType(segments[0])) {
      continue;
    }

    const sourcePath = path.join(sourceProjectPath, relativeFile);
    const destinationPath = path.join(projectPath, relativeFile);

    if (!(await exists(sourcePath))) {
      continue;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
    copiedFiles.push(relativeFile);
  }

  return copiedFiles;
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

        try {
          if (req.method === 'GET' && url.pathname === '/api/context-root') {
            const payload = await buildContextRootResponse(config);
            sendJson(res, 200, payload);
            return;
          }

          if (req.method === 'GET' && url.pathname === '/api/previous-projects') {
            const payload = await buildPreviousProjectsResponse(config);
            sendJson(res, 200, payload);
            return;
          }

          if (req.method === 'POST' && url.pathname === '/api/handoff') {
            const payload = (await readJson(req)) as {
              timestamp: string;
              defaultContext: { included: string[]; excluded: string[] };
              pastedContent: unknown[];
              importedFrom?: { projectName: string; importedTypes: string[]; files: string[] };
            };

            const contextualDir = path.join(config.projectPath, '.contextual');
            await fs.mkdir(contextualDir, { recursive: true });

            const copiedFiles = await copyImportedFiles(
              config.projectPath,
              config.previousProjectsPath,
              payload.importedFrom
            );

            const handoffPath = path.join(contextualDir, 'handoff.json');
            await fs.writeFile(handoffPath, JSON.stringify(payload, null, 2), 'utf8');

            sendJson(res, 200, {
              handoffPath,
              copiedFiles,
            });
            return;
          }
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return;
        }

        next();
      });
    },
  };
}
