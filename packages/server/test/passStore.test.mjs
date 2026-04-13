// =============================================================================
// PassStore Unit Tests
// =============================================================================
// Tests for pass persistence, retrieval, selector matching, and inspect queries.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { PassStore } from '../dist/passes/PassStore.js';

function makePass(overrides = {}) {
  return {
    id: `pass-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    instructions: [
      {
        id: 'inst-1',
        element: {
          selector: 'button.save-btn',
          label: 'Save button',
          selectionMode: 'click',
          boundingBox: { x: 0, y: 0, width: 100, height: 40 },
          tagName: 'button',
        },
        rawText: 'Make this bigger',
        actions: [],
        preAttachedContext: [],
      },
    ],
    ...overrides,
  };
}

test('PassStore creates and reads back a pass', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    const pass = makePass({ id: 'roundtrip-test' });
    const filePath = await store.createPass(pass);
    assert.ok(filePath.endsWith('.json'));

    const retrieved = await store.getPass('roundtrip-test');
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'roundtrip-test');
    assert.equal(retrieved.instructions.length, 1);
    assert.equal(retrieved.instructions[0].element.label, 'Save button');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PassStore lists passes sorted by timestamp descending', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    const older = makePass({ id: 'older', timestamp: '2025-01-01T00:00:00Z' });
    const newer = makePass({ id: 'newer', timestamp: '2025-06-01T00:00:00Z' });

    await store.createPass(older);
    await store.createPass(newer);

    const passes = await store.listPasses();
    assert.equal(passes.length, 2);
    assert.equal(passes[0].id, 'newer');
    assert.equal(passes[1].id, 'older');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PassStore returns summaries with instruction counts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    const pass = makePass({
      id: 'multi',
      instructions: [
        {
          id: 'i1',
          element: { selector: 'div.a', label: 'A', selectionMode: 'click', boundingBox: { x: 0, y: 0, width: 1, height: 1 }, tagName: 'div' },
          rawText: 'Do thing A',
          actions: [],
          preAttachedContext: [],
        },
        {
          id: 'i2',
          element: { selector: 'div.b', label: 'B', selectionMode: 'click', boundingBox: { x: 0, y: 0, width: 1, height: 1 }, tagName: 'div' },
          rawText: 'Do thing B',
          actions: [],
          preAttachedContext: [],
        },
      ],
    });
    await store.createPass(pass);

    const summaries = await store.listPassSummaries();
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].instructionCount, 2);
    assert.deepEqual(summaries[0].elementLabels, ['A', 'B']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PassStore getPass returns null for unknown ID', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    const result = await store.getPass('nonexistent');
    assert.equal(result, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PassStore normalizes missing arrays', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    // Write a pass missing optional arrays
    const pass = {
      id: 'sparse-pass',
      timestamp: new Date().toISOString(),
      instructions: [
        {
          element: {
            selector: 'div.test',
            label: 'Test',
            selectionMode: 'click',
            boundingBox: { x: 0, y: 0, width: 1, height: 1 },
            tagName: 'div',
          },
          rawText: 'Test it',
          actions: [],
          // preAttachedContext intentionally missing
        },
      ],
      // affectedContextTypes and loadedContextPaths intentionally missing
    };

    await store.createPass(pass);
    const retrieved = await store.getPass('sparse-pass');
    assert.ok(retrieved);
    assert.ok(Array.isArray(retrieved.affectedContextTypes));
    assert.ok(Array.isArray(retrieved.loadedContextPaths));
    assert.ok(Array.isArray(retrieved.instructions[0].preAttachedContext));
    // Instruction should get an auto-generated ID
    assert.ok(retrieved.instructions[0].id.includes('sparse-pass'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PassStore getPassesForElement matches by selector', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    const pass = makePass({
      id: 'selector-test',
      instructions: [
        {
          id: 'i1',
          element: {
            selector: 'button.primary-cta',
            label: 'CTA',
            selectionMode: 'click',
            boundingBox: { x: 0, y: 0, width: 1, height: 1 },
            tagName: 'button',
          },
          rawText: 'Make bigger',
          actions: [],
          preAttachedContext: [],
        },
      ],
    });
    await store.createPass(pass);

    // Exact match
    const exact = await store.getPassesForElement('button.primary-cta');
    assert.equal(exact.length, 1);
    assert.equal(exact[0].passId, 'selector-test');

    // No match
    const noMatch = await store.getPassesForElement('div.unrelated');
    assert.equal(noMatch.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PassStore skips malformed JSON files gracefully', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'passstore-'));

  try {
    const store = new PassStore(root);
    await store.initialize();

    // Write a good pass
    const goodPass = makePass({ id: 'good-pass' });
    await store.createPass(goodPass);

    // Write a malformed file
    const passesDir = path.join(root, 'passes');
    await fs.writeFile(path.join(passesDir, 'pass-bad.json'), '{ invalid json', 'utf8');

    // Should return only the good pass without crashing
    const passes = await store.listPasses();
    assert.equal(passes.length, 1);
    assert.equal(passes[0].id, 'good-pass');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
