// =============================================================================
// Outcome Store
// =============================================================================
// Reads and writes pass outcome records as JSON files in the /outcomes folder.
// Outcomes capture what happened after a pass was executed and reviewed:
// approval status, changed files, feedback, and any corpus writebacks.
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { OutcomeSummary, PassOutcome } from '@contextualapp/shared';
import { normalizeOutcomeBase } from '../normalize.js';

/** Sanitize an ISO timestamp for use in filenames (replace colons with dashes) */
function toFilenameSafe(isoTimestamp: string): string {
  return isoTimestamp.replace(/:/g, '-');
}

/** Check if a value looks like a valid PassOutcome object */
function isPassOutcome(value: unknown): value is PassOutcome {
  if (!value || typeof value !== 'object') return false;
  const outcome = value as PassOutcome;
  return (
    typeof outcome.id === 'string' &&
    typeof outcome.passId === 'string' &&
    typeof outcome.timestamp === 'string' &&
    typeof outcome.status === 'string' &&
    Array.isArray(outcome.changedFiles) &&
    Array.isArray(outcome.writebacks)
  );
}

/** Alias the shared base normalizer for local use */
const normalizeOutcome = normalizeOutcomeBase;

export class OutcomeStore {
  private readonly outcomesDir: string;

  constructor(contextRoot: string) {
    this.outcomesDir = path.join(path.resolve(contextRoot), 'outcomes');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.outcomesDir, { recursive: true });
  }

  async createOutcome(outcome: PassOutcome): Promise<string> {
    await this.initialize();

    // The caller (server.ts) already normalizes; write directly.
    const filename = `outcome-${toFilenameSafe(outcome.timestamp)}.json`;
    const filePath = path.join(this.outcomesDir, filename);

    await fs.writeFile(filePath, JSON.stringify(outcome, null, 2), 'utf8');

    return filePath;
  }

  async getOutcome(id: string): Promise<PassOutcome | null> {
    const outcomes = await this.readAllOutcomes();
    return outcomes.find((outcome) => outcome.id === id) ?? null;
  }

  async listOutcomes(): Promise<PassOutcome[]> {
    const outcomes = await this.readAllOutcomes();
    return outcomes.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async listOutcomeSummaries(): Promise<OutcomeSummary[]> {
    const outcomes = await this.listOutcomes();
    return outcomes.map((outcome) => ({
      id: outcome.id,
      passId: outcome.passId,
      timestamp: outcome.timestamp,
      status: outcome.status,
      project: outcome.project,
      affectedContextTypes: outcome.affectedContextTypes,
      changedFileCount: outcome.changedFiles.length,
      writebackCount: outcome.writebacks.length,
    }));
  }

  async getOutcomesForPass(passId: string): Promise<PassOutcome[]> {
    const outcomes = await this.listOutcomes();
    return outcomes.filter((outcome) => outcome.passId === passId);
  }

  async getLatestOutcomeForPass(passId: string): Promise<PassOutcome | null> {
    const outcomes = await this.getOutcomesForPass(passId);
    return outcomes[0] ?? null;
  }

  private async readAllOutcomes(): Promise<PassOutcome[]> {
    try {
      await fs.access(this.outcomesDir);
    } catch {
      return [];
    }

    const entries = await fs.readdir(this.outcomesDir);
    const jsonFiles = entries.filter(
      (name) => name.startsWith('outcome-') && name.endsWith('.json')
    );

    const outcomes: PassOutcome[] = [];

    for (const filename of jsonFiles) {
      try {
        const filePath = path.join(this.outcomesDir, filename);
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed: unknown = JSON.parse(raw);

        if (isPassOutcome(parsed)) {
          outcomes.push(normalizeOutcome(parsed));
        } else {
          console.warn(`[OutcomeStore] Skipping invalid outcome file: ${filename}`);
        }
      } catch (error) {
        console.warn(`[OutcomeStore] Failed to read ${filename}:`, error);
      }
    }

    return outcomes;
  }
}
