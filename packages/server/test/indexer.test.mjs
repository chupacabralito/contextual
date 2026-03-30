import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ContextIndex } from '../dist/indexer/ContextIndex.js';

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/context-root'
);

test('ContextIndex indexes fixture files and reports stats', async () => {
  const index = new ContextIndex(fixtureRoot, { watch: false });
  await index.ready();

  const stats = await index.getStats();

  assert.equal(stats.indexedFiles, 4);
  assert.deepEqual(stats.availableTypes, ['research', 'taste', 'strategy']);

  await index.close();
});

test('ContextIndex search returns ranked matches with dates', async () => {
  const index = new ContextIndex(fixtureRoot, { watch: false });
  await index.ready();

  const results = await index.search('save button', 'research');

  assert.ok(results.length >= 1);
  assert.equal(results[0].source, 'research/save-button.md');
  assert.equal(results[0].date, '2025-01-15');
  assert.match(results[0].content, /save button/i);

  await index.close();
});

test('ContextIndex suggest returns file-based suggestions and type suggestions', async () => {
  const index = new ContextIndex(fixtureRoot, { watch: false });
  await index.ready();

  const fileSuggestions = await index.suggest('save');
  assert.ok(fileSuggestions.some((item) => item.text === 'save-button' && item.type === 'research'));

  const typeSuggestions = await index.suggest('str');
  assert.ok(typeSuggestions.some((item) => item.text === 'strategy' && item.type === 'strategy'));

  await index.close();
});
