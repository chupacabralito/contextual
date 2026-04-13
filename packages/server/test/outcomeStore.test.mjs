// =============================================================================
// OutcomeStore Unit Tests
// =============================================================================
// Tests for outcome persistence, retrieval, and pass-outcome linking.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { OutcomeStore } from '../dist/outcomes/OutcomeStore.js';

function makeOutcome(overrides = {}) {
  return {
    id: `outcome-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    passId: 'pass-001',
    timestamp: new Date().toISOString(),
    status: 'pending',
    changedFiles: [],
    writebacks: [],
    ...overrides,
  };
}

test('OutcomeStore creates and reads back an outcome', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    const outcome = makeOutcome({ id: 'roundtrip-outcome' });
    const filePath = await store.createOutcome(outcome);
    assert.ok(filePath.endsWith('.json'));

    const retrieved = await store.getOutcome('roundtrip-outcome');
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'roundtrip-outcome');
    assert.equal(retrieved.status, 'pending');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OutcomeStore lists outcomes sorted by timestamp descending', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    const older = makeOutcome({ id: 'older', timestamp: '2025-01-01T00:00:00Z' });
    const newer = makeOutcome({ id: 'newer', timestamp: '2025-06-01T00:00:00Z' });

    await store.createOutcome(older);
    await store.createOutcome(newer);

    const outcomes = await store.listOutcomes();
    assert.equal(outcomes.length, 2);
    assert.equal(outcomes[0].id, 'newer');
    assert.equal(outcomes[1].id, 'older');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OutcomeStore returns summaries with counts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    const outcome = makeOutcome({
      id: 'summary-test',
      status: 'approved',
      changedFiles: ['a.tsx', 'b.tsx'],
      writebacks: [{ path: 'learned/x.md', kind: 'learned', summary: 'Test', sourcePassIds: ['pass-001'] }],
    });
    await store.createOutcome(outcome);

    const summaries = await store.listOutcomeSummaries();
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].changedFileCount, 2);
    assert.equal(summaries[0].writebackCount, 1);
    assert.equal(summaries[0].status, 'approved');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OutcomeStore getOutcomesForPass filters by passId', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    await store.createOutcome(makeOutcome({ id: 'o1', passId: 'pass-A', timestamp: '2025-01-01T00:00:00Z' }));
    await store.createOutcome(makeOutcome({ id: 'o2', passId: 'pass-B', timestamp: '2025-01-02T00:00:00Z' }));
    await store.createOutcome(makeOutcome({ id: 'o3', passId: 'pass-A', timestamp: '2025-01-03T00:00:00Z' }));

    const forA = await store.getOutcomesForPass('pass-A');
    assert.equal(forA.length, 2);
    assert.ok(forA.every((o) => o.passId === 'pass-A'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OutcomeStore getLatestOutcomeForPass returns most recent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    await store.createOutcome(makeOutcome({ id: 'earliest', passId: 'pass-X', timestamp: '2025-01-01T00:00:00Z' }));
    await store.createOutcome(makeOutcome({ id: 'latest', passId: 'pass-X', timestamp: '2025-06-01T00:00:00Z' }));

    const latest = await store.getLatestOutcomeForPass('pass-X');
    assert.ok(latest);
    assert.equal(latest.id, 'latest');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OutcomeStore getOutcome returns null for unknown ID', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    const result = await store.getOutcome('nonexistent');
    assert.equal(result, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('OutcomeStore normalizes missing arrays', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outcomestore-'));

  try {
    const store = new OutcomeStore(root);
    await store.initialize();

    // Write directly to simulate old/sparse data
    const outcomesDir = path.join(root, 'outcomes');
    await fs.writeFile(
      path.join(outcomesDir, 'outcome-sparse.json'),
      JSON.stringify({
        id: 'sparse',
        passId: 'pass-1',
        timestamp: '2025-01-01T00:00:00Z',
        status: 'pending',
        changedFiles: [],
        writebacks: [],
        // affectedContextTypes, loadedContextPaths, instructionReviews intentionally missing
      }),
      'utf8'
    );

    const retrieved = await store.getOutcome('sparse');
    assert.ok(retrieved);
    assert.ok(Array.isArray(retrieved.affectedContextTypes));
    assert.ok(Array.isArray(retrieved.loadedContextPaths));
    assert.ok(Array.isArray(retrieved.instructionReviews));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
