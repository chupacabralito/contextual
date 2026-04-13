import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { TerminalPairing } from '@contextual/shared';

export class PairingStore {
  private readonly pairingDir: string;
  private readonly pairingPath: string;

  constructor(contextRoot: string) {
    this.pairingDir = path.join(path.resolve(contextRoot), '.contextual');
    this.pairingPath = path.join(this.pairingDir, 'terminal-pairing.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.pairingDir, { recursive: true });
  }

  async getPairing(): Promise<TerminalPairing | null> {
    try {
      const raw = await fs.readFile(this.pairingPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<TerminalPairing>;

      if (
        parsed.terminalApp !== 'Terminal.app' ||
        typeof parsed.tty !== 'string' ||
        !parsed.tty.trim() ||
        typeof parsed.termProgram !== 'string' ||
        !parsed.termProgram.trim() ||
        typeof parsed.pairedAt !== 'string' ||
        typeof parsed.updatedAt !== 'string'
      ) {
        return null;
      }

      return {
        terminalApp: 'Terminal.app',
        tty: parsed.tty,
        termProgram: parsed.termProgram,
        pairedAt: parsed.pairedAt,
        updatedAt: parsed.updatedAt,
        workingDirectory:
          typeof parsed.workingDirectory === 'string' ? parsed.workingDirectory : undefined,
      };
    } catch {
      return null;
    }
  }

  async savePairing(
    pairing: Omit<TerminalPairing, 'terminalApp' | 'pairedAt' | 'updatedAt'> & {
      pairedAt?: string;
      updatedAt?: string;
    }
  ): Promise<TerminalPairing> {
    await this.initialize();
    const existing = await this.getPairing();
    const timestamp = new Date().toISOString();

    const nextPairing: TerminalPairing = {
      terminalApp: 'Terminal.app',
      tty: pairing.tty,
      termProgram: pairing.termProgram,
      pairedAt: existing?.pairedAt ?? pairing.pairedAt ?? timestamp,
      updatedAt: pairing.updatedAt ?? timestamp,
      workingDirectory: pairing.workingDirectory,
    };

    await fs.writeFile(this.pairingPath, JSON.stringify(nextPairing, null, 2), 'utf8');
    return nextPairing;
  }

  async clearPairing(): Promise<boolean> {
    try {
      await fs.unlink(this.pairingPath);
      return true;
    } catch {
      return false;
    }
  }

  getPairingPath(): string {
    return this.pairingPath;
  }
}
