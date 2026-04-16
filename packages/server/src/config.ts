// =============================================================================
// Contextual Project Config
// =============================================================================
// Persisted config at .contextual/config.json that stores project metadata
// so CLI commands can resolve the context root without relying on cwd.
//
// Resolution order:
//   1. Explicit --context-root flag
//   2. .contextual/config.json in the given project directory
//   3. .contextual/ directory in the current working directory
//   4. Current working directory as fallback
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';

/** Persisted project config written by `contextual init` */
export interface ProjectConfig {
  /** Absolute path to the project directory (where .contextual/ lives) */
  projectDir: string;
  /** Absolute path to the context root (.contextual/ folder) */
  contextRoot: string;
  /** Human-readable project name */
  projectName: string;
  /** Server port (default: 4700) */
  port?: number;
}

const CONFIG_FILENAME = 'config.json';
const CONTEXTUAL_DIR = '.contextual';

/**
 * Check if a path exists on disk.
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a persisted project config from a .contextual/ directory.
 * Returns null if the config doesn't exist or is malformed.
 */
export async function readProjectConfig(contextRoot: string): Promise<ProjectConfig | null> {
  const configPath = path.join(contextRoot, CONFIG_FILENAME);
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ProjectConfig>;

    if (
      typeof parsed.projectDir !== 'string' ||
      typeof parsed.contextRoot !== 'string' ||
      typeof parsed.projectName !== 'string'
    ) {
      return null;
    }

    return {
      projectDir: parsed.projectDir,
      contextRoot: parsed.contextRoot,
      projectName: parsed.projectName,
      port: typeof parsed.port === 'number' ? parsed.port : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Write a project config to .contextual/config.json.
 * Creates the directory if it doesn't exist.
 */
export async function writeProjectConfig(config: ProjectConfig): Promise<string> {
  const configPath = path.join(config.contextRoot, CONFIG_FILENAME);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return configPath;
}

/**
 * Resolve the context root using the standard resolution order:
 *   1. Explicit --context-root flag value
 *   2. .contextual/ directory in the given search directory
 *   3. .contextual/ directory in process.cwd()
 *   4. process.cwd() itself as a last resort
 *
 * Returns an absolute path.
 */
export async function resolveContextRoot(options: {
  /** Explicit --context-root flag from CLI */
  explicitContextRoot?: string;
  /** Directory to search for .contextual/ (defaults to cwd) */
  searchDir?: string;
}): Promise<{ contextRoot: string; source: 'flag' | 'config' | 'detected' | 'cwd' }> {
  // 1. Explicit flag always wins
  if (options.explicitContextRoot) {
    return {
      contextRoot: path.resolve(options.explicitContextRoot),
      source: 'flag',
    };
  }

  const searchDir = path.resolve(options.searchDir ?? process.cwd());

  // 2. Check for .contextual/ in the search directory and read its config
  const contextualDir = path.join(searchDir, CONTEXTUAL_DIR);
  if (await exists(contextualDir)) {
    const config = await readProjectConfig(contextualDir);
    if (config) {
      return {
        contextRoot: path.resolve(config.contextRoot),
        source: 'config',
      };
    }
    // .contextual/ exists but no config — still use it
    return {
      contextRoot: path.resolve(contextualDir),
      source: 'detected',
    };
  }

  // 3. If the search directory itself looks like a context root (has passes/ or
  //    compiled.md files), use it directly
  if (
    await exists(path.join(searchDir, 'passes')) ||
    await exists(path.join(searchDir, 'research'))
  ) {
    return {
      contextRoot: searchDir,
      source: 'detected',
    };
  }

  // 4. Fall back to cwd (commands will validate this exists)
  return {
    contextRoot: searchDir,
    source: 'cwd',
  };
}
