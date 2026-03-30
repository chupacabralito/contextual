// =============================================================================
// Pass Store
// =============================================================================
// Reads and writes pass records as JSON files in the /passes folder.
// Each pass is a timestamped JSON file: pass-2026-03-29T14-22-01Z.json
//
// This is the persistence layer for Instruct mode. Every submitted pass
// gets written here. Inspect mode reads from here to build decision trails.
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import type {
  Pass,
  PassSummary,
  Instruction,
  PreAttachedSnippet,
  InspectPassReference,
} from '@contextual/shared';

/** Sanitize an ISO timestamp for use in filenames (replace colons with dashes) */
function toFilenameSafe(isoTimestamp: string): string {
  return isoTimestamp.replace(/:/g, '-');
}

/** Check if a value looks like a valid Pass object */
function isPass(value: unknown): value is Pass {
  if (!value || typeof value !== 'object') return false;
  const p = value as Pass;
  return (
    typeof p.id === 'string' &&
    typeof p.timestamp === 'string' &&
    typeof p.depth === 'string' &&
    Array.isArray(p.instructions)
  );
}

/**
 * Manages pass record persistence in the /passes folder.
 */
export class PassStore {
  private readonly passesDir: string;

  constructor(contextRoot: string) {
    this.passesDir = path.join(path.resolve(contextRoot), 'passes');
  }

  /**
   * Ensure the /passes directory exists.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.passesDir, { recursive: true });
  }

  /**
   * Write a pass record to disk.
   * Returns the file path where the pass was written.
   */
  async createPass(pass: Pass): Promise<string> {
    await this.initialize();

    const filename = `pass-${toFilenameSafe(pass.timestamp)}.json`;
    const filePath = path.join(this.passesDir, filename);

    await fs.writeFile(filePath, JSON.stringify(pass, null, 2), 'utf8');

    return filePath;
  }

  /**
   * Read a single pass by ID.
   * Scans all pass files to find the matching ID.
   */
  async getPass(id: string): Promise<Pass | null> {
    const passes = await this.readAllPasses();
    return passes.find((p) => p.id === id) ?? null;
  }

  /**
   * List all passes, most recent first.
   */
  async listPasses(): Promise<Pass[]> {
    const passes = await this.readAllPasses();
    return passes.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * List pass summaries (for GET /passes list view).
   */
  async listPassSummaries(): Promise<PassSummary[]> {
    const passes = await this.listPasses();
    return passes.map((pass) => ({
      id: pass.id,
      timestamp: pass.timestamp,
      depth: pass.depth,
      instructionCount: pass.instructions.length,
      elementLabels: pass.instructions.map((i) => i.element.label),
    }));
  }

  /**
   * Find all passes that contain an instruction targeting the given selector.
   * Returns pass references with the matching instruction, most recent first.
   */
  async getPassesForElement(selector: string): Promise<InspectPassReference[]> {
    const passes = await this.listPasses();
    const references: InspectPassReference[] = [];

    for (const pass of passes) {
      for (const instruction of pass.instructions) {
        if (instruction.element.selector === selector) {
          references.push({
            passId: pass.id,
            timestamp: pass.timestamp,
            instruction,
          });
        }
      }
    }

    return references;
  }

  /**
   * Collect all pre-attached context snippets for a given element selector,
   * across all passes. Used for the contextHistory field in InspectResponse.
   */
  async getContextHistoryForElement(selector: string): Promise<PreAttachedSnippet[]> {
    const passes = await this.listPasses();
    const snippets: PreAttachedSnippet[] = [];
    const seen = new Set<string>();

    for (const pass of passes) {
      for (const instruction of pass.instructions) {
        if (instruction.element.selector === selector) {
          for (const snippet of instruction.preAttachedContext) {
            // Deduplicate by type+query+source
            const key = `${snippet.type}:${snippet.query}:${snippet.source}`;
            if (!seen.has(key)) {
              seen.add(key);
              snippets.push(snippet);
            }
          }
        }
      }
    }

    return snippets;
  }

  /**
   * Read all pass files from disk.
   */
  private async readAllPasses(): Promise<Pass[]> {
    try {
      await fs.access(this.passesDir);
    } catch {
      return [];
    }

    const entries = await fs.readdir(this.passesDir);
    const jsonFiles = entries.filter(
      (name) => name.startsWith('pass-') && name.endsWith('.json')
    );

    const passes: Pass[] = [];

    for (const filename of jsonFiles) {
      try {
        const filePath = path.join(this.passesDir, filename);
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed: unknown = JSON.parse(raw);

        if (isPass(parsed)) {
          passes.push(parsed);
        } else {
          console.warn(`[PassStore] Skipping invalid pass file: ${filename}`);
        }
      } catch (error) {
        console.warn(`[PassStore] Failed to read ${filename}:`, error);
      }
    }

    return passes;
  }
}
