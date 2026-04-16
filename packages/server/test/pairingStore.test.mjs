import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { PairingStore } from '../dist/dispatch/PairingStore.js';

/** Create a fresh temp directory for each test */
async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'contextual-pairing-'));
}

test('PairingStore writes terminal-pairing.json directly in context root (no .contextual nesting)', async () => {
  const contextRoot = await makeTempDir();

  try {
    const store = new PairingStore(contextRoot);
    await store.savePairing({
      tty: '/dev/ttys001',
      termProgram: 'Apple_Terminal',
      workingDirectory: '/tmp',
    });

    // The file should be at contextRoot/terminal-pairing.json
    const expectedPath = path.join(contextRoot, 'terminal-pairing.json');
    assert.equal(store.getPairingPath(), expectedPath);

    const content = await fs.readFile(expectedPath, 'utf8');
    const pairing = JSON.parse(content);
    assert.equal(pairing.tty, '/dev/ttys001');
    assert.equal(pairing.terminalApp, 'Terminal.app');

    // Verify NO .contextual subdirectory was created
    const nestedDir = path.join(contextRoot, '.contextual');
    try {
      await fs.access(nestedDir);
      assert.fail('.contextual/ subdirectory should not exist inside the context root');
    } catch {
      // Expected — directory should not exist
    }
  } finally {
    await fs.rm(contextRoot, { recursive: true, force: true });
  }
});

test('PairingStore round-trip: save and read', async () => {
  const contextRoot = await makeTempDir();

  try {
    const store = new PairingStore(contextRoot);
    const saved = await store.savePairing({
      tty: '/dev/ttys042',
      termProgram: 'Apple_Terminal',
      workingDirectory: '/Users/test/project',
    });

    assert.equal(saved.tty, '/dev/ttys042');
    assert.equal(saved.terminalApp, 'Terminal.app');
    assert.equal(saved.workingDirectory, '/Users/test/project');

    const read = await store.getPairing();
    assert.deepEqual(read, saved);
  } finally {
    await fs.rm(contextRoot, { recursive: true, force: true });
  }
});

test('PairingStore.getPairing returns null when no pairing exists', async () => {
  const contextRoot = await makeTempDir();

  try {
    const store = new PairingStore(contextRoot);
    const result = await store.getPairing();
    assert.equal(result, null);
  } finally {
    await fs.rm(contextRoot, { recursive: true, force: true });
  }
});

test('PairingStore.clearPairing removes the file', async () => {
  const contextRoot = await makeTempDir();

  try {
    const store = new PairingStore(contextRoot);
    await store.savePairing({
      tty: '/dev/ttys001',
      termProgram: 'Apple_Terminal',
    });

    const cleared = await store.clearPairing();
    assert.equal(cleared, true);

    const after = await store.getPairing();
    assert.equal(after, null);
  } finally {
    await fs.rm(contextRoot, { recursive: true, force: true });
  }
});

test('PairingStore works when context root is a .contextual directory', async () => {
  // Simulates: projectDir/.contextual as the context root
  const projectDir = await makeTempDir();
  const contextRoot = path.join(projectDir, '.contextual');
  await fs.mkdir(contextRoot, { recursive: true });

  try {
    const store = new PairingStore(contextRoot);
    await store.savePairing({
      tty: '/dev/ttys099',
      termProgram: 'Apple_Terminal',
    });

    // File should be at projectDir/.contextual/terminal-pairing.json
    const expectedPath = path.join(contextRoot, 'terminal-pairing.json');
    assert.equal(store.getPairingPath(), expectedPath);

    // NOT at projectDir/.contextual/.contextual/terminal-pairing.json
    const badPath = path.join(contextRoot, '.contextual', 'terminal-pairing.json');
    try {
      await fs.access(badPath);
      assert.fail('Should not create nested .contextual/.contextual directory');
    } catch {
      // Expected
    }

    const read = await store.getPairing();
    assert.equal(read.tty, '/dev/ttys099');
  } finally {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
});
