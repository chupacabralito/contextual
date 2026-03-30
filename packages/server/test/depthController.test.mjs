import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveByDepth } from '../dist/resolver/depthController.js';

const matches = [
  {
    content: 'A long context finding about save button visibility and user hesitation in checkout.',
    source: 'research/save-visibility.md',
    date: '2025-01-01',
    relevance: 0.95,
  },
  {
    content: 'Another finding about users expecting the primary action in the top right.',
    source: 'research/top-right.md',
    date: '2025-01-02',
    relevance: 0.85,
  },
  {
    content: 'Third finding with supporting detail.',
    source: 'research/supporting.md',
    date: '2025-01-03',
    relevance: 0.75,
  },
];

test('resolveByDepth light truncates and limits to one match', async () => {
  const result = await resolveByDepth(matches, 'light');

  assert.equal(result.length, 1);
  assert.equal(result[0].relatedFindings, undefined);
  assert.match(result[0].content, /save button visibility/i);
  assert.ok(result[0].content.length <= 120);
});

test('resolveByDepth standard returns top three without related findings', async () => {
  const result = await resolveByDepth(matches, 'standard');

  assert.equal(result.length, 3);
  assert.equal(result[0].relatedFindings, undefined);
  assert.equal(result[2].source, 'research/supporting.md');
});

test('resolveByDepth detailed requests related findings for selected matches', async () => {
  const seen = [];

  const result = await resolveByDepth(matches, 'detailed', {
    getRelatedFindings: async (match) => {
      seen.push(match.source);
      return [`Related to ${match.source}`];
    },
  });

  assert.deepEqual(seen, matches.map((match) => match.source));
  assert.deepEqual(result[0].relatedFindings, ['Related to research/save-visibility.md']);
});
