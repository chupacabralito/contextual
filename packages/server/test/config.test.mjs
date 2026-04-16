import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { resolveContextRoot, readProjectConfig, writeProjectConfig } from '../dist/config.js';

/** Create a fresh temp directory for each test */
async function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'contextual-config-'));
}

// =============================================================================
// writeProjectConfig / readProjectConfig
// =============================================================================

test('writeProjectConfig creates config.json and readProjectConfig reads it', async () => {
  const tempDir = await makeTempDir();
  const contextRoot = path.join(tempDir, '.contextual');
  await fs.mkdir(contextRoot, { recursive: true });

  try {
    const config = {
      projectDir: tempDir,
      contextRoot,
      projectName: 'test-project',
      port: 4700,
    };

    const configPath = await writeProjectConfig(config);
    assert.equal(configPath, path.join(contextRoot, 'config.json'));

    const read = await readProjectConfig(contextRoot);
    assert.deepEqual(read, config);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('readProjectConfig returns null for missing config', async () => {
  const tempDir = await makeTempDir();
  try {
    const result = await readProjectConfig(tempDir);
    assert.equal(result, null);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('readProjectConfig returns null for malformed config', async () => {
  const tempDir = await makeTempDir();
  try {
    await fs.writeFile(path.join(tempDir, 'config.json'), '{"bad": true}', 'utf8');
    const result = await readProjectConfig(tempDir);
    assert.equal(result, null);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// resolveContextRoot
// =============================================================================

test('resolveContextRoot: explicit flag wins over everything', async () => {
  const tempDir = await makeTempDir();
  try {
    const result = await resolveContextRoot({
      explicitContextRoot: tempDir,
      searchDir: '/some/other/dir',
    });
    assert.equal(result.contextRoot, tempDir);
    assert.equal(result.source, 'flag');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveContextRoot: finds .contextual/ with config.json in search dir', async () => {
  const tempDir = await makeTempDir();
  const contextRoot = path.join(tempDir, '.contextual');
  await fs.mkdir(contextRoot, { recursive: true });

  try {
    await writeProjectConfig({
      projectDir: tempDir,
      contextRoot,
      projectName: 'from-config',
    });

    const result = await resolveContextRoot({ searchDir: tempDir });
    assert.equal(result.contextRoot, contextRoot);
    assert.equal(result.source, 'config');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveContextRoot: finds .contextual/ without config.json', async () => {
  const tempDir = await makeTempDir();
  const contextRoot = path.join(tempDir, '.contextual');
  await fs.mkdir(contextRoot, { recursive: true });

  try {
    const result = await resolveContextRoot({ searchDir: tempDir });
    assert.equal(result.contextRoot, contextRoot);
    assert.equal(result.source, 'detected');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveContextRoot: detects standalone context root with passes/', async () => {
  const tempDir = await makeTempDir();
  await fs.mkdir(path.join(tempDir, 'passes'), { recursive: true });

  try {
    const result = await resolveContextRoot({ searchDir: tempDir });
    assert.equal(result.contextRoot, tempDir);
    assert.equal(result.source, 'detected');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('resolveContextRoot: falls back to search dir when nothing found', async () => {
  const tempDir = await makeTempDir();
  try {
    const result = await resolveContextRoot({ searchDir: tempDir });
    assert.equal(result.contextRoot, tempDir);
    assert.equal(result.source, 'cwd');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
