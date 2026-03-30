// =============================================================================
// Tool Store
// =============================================================================
// Reads and writes tool configuration as a JSON file in the context root.
// Tools are @mention targets beyond the 5 local context types -- things like
// "posthog", "figma", "hotjar" that the designer enables per project.
//
// Persists to tools.json in the context root folder.
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { ConfiguredTool } from '@contextual/shared';

const TOOLS_FILENAME = 'tools.json';

/** Check if a value looks like a valid ConfiguredTool */
function isConfiguredTool(value: unknown): value is ConfiguredTool {
  if (!value || typeof value !== 'object') return false;
  const t = value as ConfiguredTool;
  return (
    typeof t.name === 'string' &&
    typeof t.label === 'string' &&
    typeof t.enabled === 'boolean'
  );
}

/**
 * Manages tool configuration persistence in tools.json.
 */
export class ToolStore {
  private readonly toolsPath: string;
  private tools: ConfiguredTool[] = [];

  constructor(contextRoot: string) {
    this.toolsPath = path.join(path.resolve(contextRoot), TOOLS_FILENAME);
  }

  /**
   * Load tools from disk. Creates an empty tools.json if none exists.
   */
  async initialize(): Promise<void> {
    try {
      const raw = await fs.readFile(this.toolsPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed) && parsed.every(isConfiguredTool)) {
        this.tools = parsed;
      } else {
        console.warn('[ToolStore] Invalid tools.json format, starting with empty list');
        this.tools = [];
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // No tools.json yet -- that's fine, start empty
        this.tools = [];
      } else {
        console.warn('[ToolStore] Failed to read tools.json:', error);
        this.tools = [];
      }
    }
  }

  /**
   * Get all configured tools.
   */
  getTools(): ConfiguredTool[] {
    return [...this.tools];
  }

  /**
   * Get only enabled tools.
   */
  getEnabledTools(): ConfiguredTool[] {
    return this.tools.filter((t) => t.enabled);
  }

  /**
   * Replace the full tool list and persist to disk.
   */
  async setTools(tools: ConfiguredTool[]): Promise<void> {
    this.tools = [...tools];
    await this.persist();
  }

  /**
   * Add or update a single tool. If a tool with the same name exists,
   * it gets replaced. Otherwise it's appended.
   */
  async upsertTool(tool: ConfiguredTool): Promise<void> {
    const idx = this.tools.findIndex((t) => t.name === tool.name);
    if (idx >= 0) {
      this.tools[idx] = tool;
    } else {
      this.tools.push(tool);
    }
    await this.persist();
  }

  /**
   * Remove a tool by name.
   */
  async removeTool(name: string): Promise<boolean> {
    const before = this.tools.length;
    this.tools = this.tools.filter((t) => t.name !== name);
    if (this.tools.length !== before) {
      await this.persist();
      return true;
    }
    return false;
  }

  /**
   * Write the current tool list to disk.
   */
  private async persist(): Promise<void> {
    await fs.writeFile(this.toolsPath, JSON.stringify(this.tools, null, 2), 'utf8');
  }
}
