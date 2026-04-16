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
} from '@contextualapp/shared';
import { normalizePassBase } from '../normalize.js';

/** Sanitize an ISO timestamp for use in filenames (replace colons with dashes) */
function toFilenameSafe(isoTimestamp: string): string {
  return isoTimestamp.replace(/:/g, '-');
}

/**
 * Strip :nth-child(...) pseudo-selectors from a CSS selector string.
 * Used for fuzzy matching when the DOM position may have shifted.
 */
function stripNthChild(selector: string): string {
  return selector.replace(/:nth-child\(\d+\)/g, '');
}

/**
 * Parse a simple CSS selector into tag and class parts.
 * E.g. "div.foo.bar:nth-child(2)" → { tag: "div", classes: ["foo", "bar"] }
 */
function parseSelector(selector: string): { tag: string; classes: string[] } {
  const stripped = stripNthChild(selector);
  // Handle ID selectors — these are exact matches only
  if (stripped.startsWith('#')) return { tag: stripped, classes: [] };

  const dotIndex = stripped.indexOf('.');
  if (dotIndex === -1) return { tag: stripped, classes: [] };

  const tag = stripped.slice(0, dotIndex);
  const classes = stripped.slice(dotIndex + 1).split('.').filter(Boolean);
  return { tag, classes };
}

/**
 * Compare two CSS selectors with tolerance for positional and class differences.
 * Matching strategy (in order of strictness):
 *   1. Exact string match (cheapest)
 *   2. Both selectors stripped of :nth-child() match each other
 *      (same tag + classes, different sibling position)
 *   3. Same tag and at least one class in common (handles class drift
 *      when the DOM structure has been modified between passes)
 */
function selectorsMatch(stored: string, query: string): boolean {
  if (stored === query) return true;

  const strippedStored = stripNthChild(stored);
  const strippedQuery = stripNthChild(query);
  if (strippedStored === strippedQuery) return true;

  // Parse into tag + classes and check for partial overlap
  const s = parseSelector(stored);
  const q = parseSelector(query);

  // Tags must match
  if (s.tag !== q.tag) return false;

  // If either has no classes, tag-only match is too loose — skip
  if (s.classes.length === 0 || q.classes.length === 0) return false;

  // Check for exact class overlap first
  if (s.classes.some((cls) => q.classes.includes(cls))) return true;

  // Check for prefix-based overlap (BEM-style: "paste-zone" matches "paste-zone-inline")
  // A class is considered a prefix match if one is a prefix of the other followed by a hyphen
  return s.classes.some((sCls) =>
    q.classes.some(
      (qCls) =>
        (sCls.length >= 3 && qCls.startsWith(sCls + '-')) ||
        (qCls.length >= 3 && sCls.startsWith(qCls + '-'))
    )
  );
}

/** Check if a value looks like a valid Pass object */
function isPass(value: unknown): value is Pass {
  if (!value || typeof value !== 'object') return false;
  const p = value as Pass;
  return (
    typeof p.id === 'string' &&
    typeof p.timestamp === 'string' &&
    (p.depth === undefined || typeof p.depth === 'string') &&
    Array.isArray(p.instructions)
  );
}

/** Alias the shared base normalizer for local use */
const normalizePass = normalizePassBase;

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

    const normalizedPass = normalizePass(pass);

    const filename = `pass-${toFilenameSafe(normalizedPass.timestamp)}.json`;
    const filePath = path.join(this.passesDir, filename);

    await fs.writeFile(filePath, JSON.stringify(normalizedPass, null, 2), 'utf8');

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
      project: pass.project,
      depth: pass.depth,
      affectedContextTypes: pass.affectedContextTypes,
      loadedContextPaths: pass.loadedContextPaths,
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
        if (selectorsMatch(instruction.element.selector, selector)) {
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
   * Find passes that targeted any of the given ancestor selectors.
   * Returns references with inheritedFrom set to the matched ancestor selector.
   * Excludes any passes already found by direct matching (via excludePassIds).
   */
  async getInheritedPasses(
    ancestorSelectors: string[],
    excludePassIds: Set<string>,
  ): Promise<InspectPassReference[]> {
    const passes = await this.listPasses();
    const references: InspectPassReference[] = [];
    const seen = new Set<string>();

    for (const ancestor of ancestorSelectors) {
      for (const pass of passes) {
        for (const instruction of pass.instructions) {
          const key = `${pass.id}:${instruction.element.selector}`;
          if (seen.has(key)) continue;
          if (excludePassIds.has(pass.id)) continue;

          if (selectorsMatch(instruction.element.selector, ancestor)) {
            seen.add(key);
            references.push({
              passId: pass.id,
              timestamp: pass.timestamp,
              instruction,
              inheritedFrom: instruction.element.label || ancestor,
            });
          }
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
        if (selectorsMatch(instruction.element.selector, selector)) {
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
          passes.push(normalizePass(parsed));
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
