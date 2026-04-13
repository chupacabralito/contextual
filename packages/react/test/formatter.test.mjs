// =============================================================================
// Output Formatter Tests
// =============================================================================
// Tests for formatPass — the markdown output formatter for clipboard export.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPass } from '../dist/output/formatter.js';

function makeInstruction(overrides = {}) {
  return {
    id: 'inst-1',
    element: {
      selector: 'button.save',
      label: 'save button',
      selectionMode: 'click',
      boundingBox: { x: 100, y: 200, width: 80, height: 32 },
      tagName: 'button',
    },
    rawText: 'Make this more prominent',
    actions: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test('formatPass produces markdown with header and instruction count', () => {
  const result = formatPass([makeInstruction()]);
  assert.match(result, /## Refinement Pass/);
  assert.match(result, /\*\*Instructions:\*\* 1/);
});

test('formatPass includes element info with selector and bounding box', () => {
  const result = formatPass([makeInstruction()]);
  assert.match(result, /\*\*Element:\*\*/);
  assert.match(result, /button\.save/);
  assert.match(result, /80x32 at \[100, 200\]/);
});

test('formatPass capitalizes element label', () => {
  const result = formatPass([makeInstruction({ element: {
    selector: 'div.test',
    label: 'checkout form',
    selectionMode: 'click',
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    tagName: 'div',
  }})]);
  assert.match(result, /Checkout form/);
});

test('formatPass includes plain instruction text with mentions stripped', () => {
  const result = formatPass([makeInstruction({
    rawText: 'Fix this @research[checkout friction] issue',
  })]);
  assert.match(result, /\*\*Instruction:\*\* Fix this issue/);
});

test('formatPass lists actions as markdown bullets', () => {
  const result = formatPass([makeInstruction({
    rawText: 'Fix @research[checkout friction]',
    actions: [
      { source: 'research', instruction: 'checkout friction', startIndex: 4, endIndex: 35 },
    ],
  })]);
  assert.match(result, /- @research\[checkout friction\]/);
});

test('formatPass shows "None" when no actions', () => {
  const result = formatPass([makeInstruction({ rawText: 'Just fix it', actions: [] })]);
  assert.match(result, /- None/);
});

test('formatPass handles multiple instructions', () => {
  const queue = [
    makeInstruction({ id: 'i1', rawText: 'First instruction' }),
    makeInstruction({
      id: 'i2',
      rawText: 'Second instruction',
      element: {
        selector: 'div.hero',
        label: 'hero section',
        selectionMode: 'click',
        boundingBox: { x: 0, y: 0, width: 1200, height: 600 },
        tagName: 'div',
      },
    }),
  ];
  const result = formatPass(queue);
  assert.match(result, /\*\*Instructions:\*\* 2/);
  assert.match(result, /### Instruction 1/);
  assert.match(result, /### Instruction 2/);
  assert.match(result, /hero section/i);
});

test('formatPass includes selected text when present', () => {
  const result = formatPass([makeInstruction({
    element: {
      selector: 'p.description',
      label: 'description',
      selectionMode: 'highlight',
      boundingBox: { x: 0, y: 0, width: 300, height: 20 },
      tagName: 'p',
      selectedText: 'the quick brown fox',
    },
  })]);
  assert.match(result, /\*\*Selected text:\*\* "the quick brown fox"/);
});

test('formatPass handles empty queue', () => {
  const result = formatPass([]);
  assert.match(result, /## Refinement Pass/);
  assert.match(result, /\*\*Instructions:\*\* 0/);
});
