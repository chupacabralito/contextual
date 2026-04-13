// =============================================================================
// Mention Parser Tests
// =============================================================================
// Tests for parseActions and stripMentions from the @mention parser.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseActions, stripMentions } from '../dist/mentions/parser.js';

// ---------------------------------------------------------------------------
// parseActions
// ---------------------------------------------------------------------------

test('parseActions extracts a single @source[instruction]', () => {
  const result = parseActions('Fix this @research[checkout friction]');
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'research');
  assert.equal(result[0].instruction, 'checkout friction');
  assert.equal(result[0].startIndex, 9);
  assert.equal(result[0].endIndex, 37);
});

test('parseActions extracts multiple mentions', () => {
  const text = 'Use @taste[stripe clarity] and @design-system[button primary]';
  const result = parseActions(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].source, 'taste');
  assert.equal(result[0].instruction, 'stripe clarity');
  assert.equal(result[1].source, 'design-system');
  assert.equal(result[1].instruction, 'button primary');
});

test('parseActions returns empty array for text without mentions', () => {
  const result = parseActions('Just a regular instruction with no mentions');
  assert.equal(result.length, 0);
});

test('parseActions handles mentions at start and end of text', () => {
  const text = '@research[query] text @taste[another query]';
  const result = parseActions(text);
  assert.equal(result.length, 2);
  assert.equal(result[0].startIndex, 0);
  assert.equal(result[1].endIndex, text.length);
});

test('parseActions trims whitespace from source and instruction', () => {
  // The regex captures groups are trimmed by the parser
  const result = parseActions('@research[ spaced query ]');
  assert.equal(result.length, 1);
  assert.equal(result[0].instruction, 'spaced query');
});

test('parseActions accepts any source string (not just context types)', () => {
  const result = parseActions('@posthog[funnel analysis] and @figma[design tokens]');
  assert.equal(result.length, 2);
  assert.equal(result[0].source, 'posthog');
  assert.equal(result[1].source, 'figma');
});

test('parseActions handles hyphenated sources', () => {
  const result = parseActions('@design-system[button variants]');
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'design-system');
});

test('parseActions ignores malformed mentions', () => {
  // Missing closing bracket
  const r1 = parseActions('@research[unclosed');
  assert.equal(r1.length, 0);

  // Missing opening bracket
  const r2 = parseActions('@research query]');
  assert.equal(r2.length, 0);

  // Empty brackets
  const r3 = parseActions('@research[]');
  assert.equal(r3.length, 0);

  // @ without type
  const r4 = parseActions('@[query]');
  assert.equal(r4.length, 0);
});

test('parseActions is safe to call multiple times (regex state reset)', () => {
  const text = '@research[query one]';
  const r1 = parseActions(text);
  const r2 = parseActions(text);
  assert.equal(r1.length, 1);
  assert.equal(r2.length, 1);
  assert.equal(r1[0].source, r2[0].source);
});

// ---------------------------------------------------------------------------
// stripMentions
// ---------------------------------------------------------------------------

test('stripMentions removes all @source[instruction] and normalizes whitespace', () => {
  const result = stripMentions('Fix @research[checkout friction] on this button');
  assert.equal(result, 'Fix on this button');
});

test('stripMentions returns original text when no mentions present', () => {
  const result = stripMentions('Just a regular instruction');
  assert.equal(result, 'Just a regular instruction');
});

test('stripMentions handles text with only mentions', () => {
  const result = stripMentions('@research[query]');
  assert.equal(result, '');
});

test('stripMentions handles multiple mentions', () => {
  const result = stripMentions('@taste[a] text @design-system[b] more');
  assert.equal(result, 'text more');
});
