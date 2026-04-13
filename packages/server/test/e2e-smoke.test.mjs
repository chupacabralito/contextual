// =============================================================================
// End-to-End Smoke Test
// =============================================================================
// Exercises the core Contextual flow against a real server instance:
//   1. Scaffold or reuse a temp context root
//   2. Add a source file via the API
//   3. Compile the context type
//   4. Resolve an @mention against the compiled context
//   5. Submit a pass
//   6. Record an outcome for the pass
//   7. Inspect the element from the pass
//   8. Verify the full round-trip
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import { createServer } from '../dist/server.js';

/** Create a fresh temp directory for each test run */
async function makeTempDir() {
  const dir = path.join(os.tmpdir(), `contextual-e2e-${crypto.randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Simple HTTP helper */
async function request(baseUrl, method, urlPath, body) {
  const url = `${baseUrl}${urlPath}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  return fetch(url, options);
}

test('e2e: full pass lifecycle (add source → compile → resolve → pass → outcome → inspect)', async (t) => {
  const tempDir = await makeTempDir();

  const server = createServer({ port: 0, contextRoot: tempDir, projectName: 'smoke-test' });
  const httpServer = await server.start();
  const { port } = httpServer.address();
  const baseUrl = `http://localhost:${port}`;

  t.after(async () => {
    await server.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Step 1: Health check
  const healthRes = await request(baseUrl, 'GET', '/health');
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.project, 'smoke-test');

  // Step 2: Add a source file to the "research" context type
  const sourceContent = [
    '# Checkout Friction Study',
    '',
    'Users abandon checkout when presented with too many form fields.',
    'Trust indicators near the CTA increased conversion by 23%.',
    'Mobile users need a simplified single-page checkout flow.',
  ].join('\n');

  const addSourceRes = await request(baseUrl, 'POST', '/api/corpus/research/sources', {
    filename: 'checkout-friction.md',
    content: sourceContent,
    label: 'Checkout friction research',
  });
  assert.equal(addSourceRes.status, 201);
  const addedSource = await addSourceRes.json();
  assert.equal(addedSource.filename, 'checkout-friction.md');

  // Step 3: Compile the research type
  const compileRes = await request(baseUrl, 'POST', '/api/corpus/research/compile');
  assert.equal(compileRes.status, 200);
  const compiled = await compileRes.json();
  assert.equal(compiled.ok, true);
  assert.equal(compiled.sourceCount, 1);

  // Step 4: Verify the corpus overview shows research as populated
  const corpusRes = await request(baseUrl, 'GET', '/api/corpus');
  assert.equal(corpusRes.status, 200);
  const corpus = await corpusRes.json();
  const researchEntry = corpus.types.find((t) => t.type === 'research');
  assert.ok(researchEntry, 'research type should exist in corpus');
  assert.equal(researchEntry.exists, true);
  assert.equal(researchEntry.sourceCount, 1);

  // Wait for chokidar file watcher to detect and index the new compiled.md
  // (stabilityThreshold: 150ms + poll + processing overhead)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Step 5: Resolve an @research mention
  const resolveRes = await request(baseUrl, 'POST', '/resolve', {
    mentions: [{ type: 'research', query: 'checkout friction' }],
    depth: 'standard',
  });
  assert.equal(resolveRes.status, 200);
  const resolved = await resolveRes.json();
  assert.equal(resolved.results.length, 1);
  assert.equal(resolved.results[0].type, 'research');
  assert.equal(resolved.results[0].query, 'checkout friction');
  // Should find at least one match
  assert.ok(resolved.results[0].matches.length >= 1, 'should have at least one match');

  // Step 6: Submit a pass
  const passId = `e2e-pass-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const passPayload = {
    pass: {
      id: passId,
      timestamp,
      instructions: [
        {
          id: `${passId}_inst_1`,
          element: {
            selector: 'button.checkout-cta',
            label: 'checkout button',
            selectionMode: 'click',
            boundingBox: { x: 400, y: 600, width: 200, height: 48 },
            tagName: 'button',
          },
          rawText: 'Add trust indicators near the CTA @research[checkout friction]',
          actions: [
            { source: 'research', instruction: 'checkout friction', startIndex: 42, endIndex: 72 },
          ],
          preAttachedContext: resolved.results[0].matches.slice(0, 1).map((m) => ({
            type: 'research',
            query: 'checkout friction',
            content: m.content,
            source: m.source,
          })),
        },
      ],
    },
  };

  const passRes = await request(baseUrl, 'POST', '/passes', passPayload);
  assert.equal(passRes.status, 201);
  const createdPass = await passRes.json();
  assert.equal(createdPass.id, passId);

  // Step 7: Verify the pass appears in the list
  const listPassesRes = await request(baseUrl, 'GET', '/passes');
  assert.equal(listPassesRes.status, 200);
  const passList = await listPassesRes.json();
  assert.ok(passList.passes.length >= 1, 'should have at least one pass');
  assert.ok(passList.passes.some((p) => p.id === passId), 'our pass should be in the list');

  // Step 8: Read the pass back
  const getPassRes = await request(baseUrl, 'GET', `/passes/${passId}`);
  assert.equal(getPassRes.status, 200);
  const readPass = await getPassRes.json();
  assert.equal(readPass.id, passId);
  assert.equal(readPass.instructions.length, 1);
  assert.equal(readPass.project, 'smoke-test');

  // Step 9: Record an outcome
  const outcomeId = `e2e-outcome-${crypto.randomUUID()}`;
  const outcomeRes = await request(baseUrl, 'POST', '/outcomes', {
    outcome: {
      id: outcomeId,
      passId,
      timestamp: new Date().toISOString(),
      status: 'approved-with-feedback',
      summary: 'Added trust badge and secure checkout indicators',
      feedback: 'Looks great, but also add a money-back guarantee badge',
      changedFiles: ['src/components/CheckoutCTA.tsx'],
      writebacks: [],
      instructionReviews: [
        {
          instructionId: `${passId}_inst_1`,
          elementLabel: 'checkout button',
          rawText: 'Add trust indicators near the CTA',
          status: 'looks-good',
          feedback: 'Trust badge placement is excellent',
        },
      ],
    },
  });
  assert.equal(outcomeRes.status, 201);
  const createdOutcome = await outcomeRes.json();
  assert.equal(createdOutcome.id, outcomeId);

  // Step 10: Verify outcome appears in outcome list
  const listOutcomesRes = await request(baseUrl, 'GET', '/outcomes');
  assert.equal(listOutcomesRes.status, 200);
  const outcomeList = await listOutcomesRes.json();
  assert.ok(outcomeList.outcomes.length >= 1);
  assert.ok(outcomeList.outcomes.some((o) => o.id === outcomeId));

  // Step 11: Get the latest outcome for the pass
  const latestOutcomeRes = await request(baseUrl, 'GET', `/passes/${passId}/outcome`);
  assert.equal(latestOutcomeRes.status, 200);
  const latestOutcome = await latestOutcomeRes.json();
  assert.equal(latestOutcome.passId, passId);
  assert.equal(latestOutcome.status, 'approved-with-feedback');

  // Step 12: Inspect the element — should show the pass in the decision trail
  const inspectRes = await request(baseUrl, 'GET', `/inspect?selector=${encodeURIComponent('button.checkout-cta')}`);
  assert.equal(inspectRes.status, 200);
  const inspectData = await inspectRes.json();
  assert.equal(inspectData.selector, 'button.checkout-cta');
  assert.ok(inspectData.passes.length >= 1, 'should have at least one pass for this element');
  assert.equal(inspectData.passes[0].passId, passId);

  // Step 13: Verify suggest endpoint works
  const suggestRes = await request(baseUrl, 'GET', '/suggest?partial=check');
  assert.equal(suggestRes.status, 200);
  const suggestions = await suggestRes.json();
  assert.ok(Array.isArray(suggestions.suggestions));
});

test('e2e: project lifecycle (create → list → detail)', async (t) => {
  const tempDir = await makeTempDir();

  const server = createServer({ port: 0, contextRoot: tempDir, projectName: 'smoke-test' });
  const httpServer = await server.start();
  const { port } = httpServer.address();
  const baseUrl = `http://localhost:${port}`;

  t.after(async () => {
    await server.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Create a project
  const createRes = await request(baseUrl, 'POST', '/api/projects', {
    name: 'checkout-redesign',
    title: 'Checkout Redesign',
    description: 'Streamline the checkout flow',
    activeTypes: ['research', 'design-system'],
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.project.name, 'checkout-redesign');
  assert.equal(created.project.title, 'Checkout Redesign');

  // List projects
  const listRes = await request(baseUrl, 'GET', '/api/projects');
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.projects.some((p) => p.name === 'checkout-redesign'));

  // Get project detail
  const detailRes = await request(baseUrl, 'GET', '/api/projects/checkout-redesign');
  assert.equal(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.equal(detail.brief.name, 'checkout-redesign');
  assert.ok(detail.brief.activeTypes.includes('research'));
});
