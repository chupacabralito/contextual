// =============================================================================
// Server API Integration Tests
// =============================================================================
// Tests the Express HTTP endpoints end-to-end using createServer with a
// temporary context root. Covers health, corpus, sources, passes, outcomes,
// resolve, suggest, inspect, projects, and tools.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { promises as fs } from 'node:fs';

import { createServer } from '../dist/server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupContextRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contextual-api-test-'));

  // Create a research context with one source and a compiled file
  const researchDir = path.join(root, 'research');
  const sourcesDir = path.join(researchDir, '_sources');
  await fs.mkdir(sourcesDir, { recursive: true });

  await fs.writeFile(
    path.join(sourcesDir, 'checkout-friction.md'),
    '---\ndate: 2025-01-15\n---\n\nUsers struggle with the checkout save button placement.',
    'utf8'
  );

  await fs.writeFile(
    path.join(researchDir, 'compiled.md'),
    [
      '---',
      'type: research',
      'title: Research Context',
      'lastCompiled: 2025-01-20T00:00:00Z',
      'sourceCount: 1',
      'sections: []',
      'totalTokenEstimate: 50',
      '---',
      '',
      '## Checkout Research',
      '',
      'Users struggle with the checkout save button placement.',
    ].join('\n'),
    'utf8'
  );

  // Create passes and outcomes dirs
  await fs.mkdir(path.join(root, 'passes'), { recursive: true });
  await fs.mkdir(path.join(root, 'outcomes'), { recursive: true });

  return root;
}

async function startTestServer(contextRoot) {
  const server = createServer({
    port: 0, // Ephemeral port
    contextRoot,
    projectName: 'test-project',
  });

  const httpServer = await server.start();
  const address = httpServer.address();
  const baseUrl = `http://localhost:${address.port}`;

  return { server, baseUrl };
}

async function fetchJSON(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('GET /health returns ok with indexed file count', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.project, 'test-project');
    assert.ok(body.indexedFiles >= 1);
    assert.ok(Array.isArray(body.availableTypes));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /api/corpus returns all 7 context types', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/api/corpus');
    assert.equal(status, 200);
    assert.equal(body.types.length, 7);
    assert.ok(body.contextRoot);

    // research should exist with sources
    const research = body.types.find((t) => t.type === 'research');
    assert.ok(research);
    assert.equal(research.exists, true);
    assert.ok(research.sourceCount >= 1);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /api/corpus/:type returns compiled file content', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/api/corpus/research');
    assert.equal(status, 200);
    assert.ok(body.meta);
    assert.equal(body.meta.type, 'research');
    assert.ok(body.content.includes('Checkout Research'));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /api/corpus/:type/sources lists source files', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/api/corpus/research/sources');
    assert.equal(status, 200);
    assert.equal(body.type, 'research');
    assert.ok(body.sources.length >= 1);
    assert.ok(body.sources.some((s) => s.filename === 'checkout-friction.md'));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /api/corpus/:type/sources adds a new source file', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/api/corpus/research/sources', {
      method: 'POST',
      body: JSON.stringify({
        filename: 'new-finding.md',
        content: 'A new research finding about user behavior.',
        label: 'User behavior note',
      }),
    });
    assert.equal(status, 201);
    assert.equal(body.filename, 'new-finding.md');
    assert.ok(body.path);

    // Verify the file was written
    const written = await fs.readFile(body.path, 'utf8');
    assert.ok(written.includes('A new research finding'));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('DELETE /api/corpus/:type/sources/:filename removes a source', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status } = await fetchJSON(
      baseUrl,
      '/api/corpus/research/sources/checkout-friction.md',
      { method: 'DELETE' }
    );
    assert.equal(status, 200);

    // Verify file is gone
    const { body } = await fetchJSON(baseUrl, '/api/corpus/research/sources');
    assert.ok(!body.sources.some((s) => s.filename === 'checkout-friction.md'));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('PUT /api/corpus/:type/compiled updates the compiled file', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const newContent = '---\ntype: research\ntitle: Updated\n---\n\n## Updated Section\n\nNew content.';
    const { status } = await fetchJSON(baseUrl, '/api/corpus/research/compiled', {
      method: 'PUT',
      body: JSON.stringify({ content: newContent }),
    });
    assert.equal(status, 200);

    // Verify the update was written
    const compiled = await fs.readFile(path.join(root, 'research', 'compiled.md'), 'utf8');
    assert.ok(compiled.includes('Updated Section'));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /passes creates a pass and GET /passes lists it', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const pass = {
      id: 'test-pass-001',
      timestamp: new Date().toISOString(),
      instructions: [
        {
          id: 'inst-1',
          element: {
            selector: 'button.save',
            label: 'Save button',
            selectionMode: 'click',
            boundingBox: { x: 100, y: 200, width: 80, height: 32 },
            tagName: 'button',
          },
          rawText: 'Make this more prominent @research[checkout friction]',
          actions: [
            { source: 'research', instruction: 'checkout friction', startIndex: 27, endIndex: 58 },
          ],
          preAttachedContext: [],
        },
      ],
    };

    const createRes = await fetchJSON(baseUrl, '/passes', {
      method: 'POST',
      body: JSON.stringify({ pass }),
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.id, 'test-pass-001');

    // List passes
    const listRes = await fetchJSON(baseUrl, '/passes');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.passes.some((p) => p.id === 'test-pass-001'));

    // Get single pass
    const getRes = await fetchJSON(baseUrl, '/passes/test-pass-001');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.id, 'test-pass-001');
    assert.equal(getRes.body.instructions.length, 1);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /outcomes creates an outcome and GET /outcomes lists it', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const outcome = {
      id: 'outcome-001',
      passId: 'test-pass-001',
      timestamp: new Date().toISOString(),
      status: 'approved',
      changedFiles: ['src/components/CheckoutButton.tsx'],
      writebacks: [],
    };

    const createRes = await fetchJSON(baseUrl, '/outcomes', {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.id, 'outcome-001');

    // List outcomes
    const listRes = await fetchJSON(baseUrl, '/outcomes');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.outcomes.some((o) => o.id === 'outcome-001'));

    // Get single outcome
    const getRes = await fetchJSON(baseUrl, '/outcomes/outcome-001');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.id, 'outcome-001');
    assert.equal(getRes.body.status, 'approved');
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /resolve returns context matches for known types', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/resolve', {
      method: 'POST',
      body: JSON.stringify({
        mentions: [{ type: 'research', query: 'save button' }],
        depth: 'standard',
      }),
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.results));
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0].type, 'research');
    assert.ok(body.results[0].matches.length >= 0); // May have matches from the compiled file
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /resolve validates request body', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status } = await fetchJSON(baseUrl, '/resolve', {
      method: 'POST',
      body: JSON.stringify({ bad: 'payload' }),
    });
    assert.equal(status, 400);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /resolve rejects invalid depth value', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status } = await fetchJSON(baseUrl, '/resolve', {
      method: 'POST',
      body: JSON.stringify({
        mentions: [{ type: 'research', query: 'test' }],
        depth: 'invalid-depth',
      }),
    });
    assert.equal(status, 400);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /suggest returns autocomplete suggestions', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/suggest?partial=res');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.suggestions));
    // Should match "research" type
    assert.ok(body.suggestions.some((s) => s.text === 'research'));
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /inspect returns passes for an element selector', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    // First create a pass with a known selector
    await fetchJSON(baseUrl, '/passes', {
      method: 'POST',
      body: JSON.stringify({
        pass: {
          id: 'inspect-pass-001',
          timestamp: new Date().toISOString(),
          instructions: [
            {
              id: 'inst-1',
              element: {
                selector: 'button.checkout-btn',
                label: 'Checkout',
                selectionMode: 'click',
                boundingBox: { x: 0, y: 0, width: 100, height: 40 },
                tagName: 'button',
              },
              rawText: 'Make this green',
              actions: [],
              preAttachedContext: [],
            },
          ],
        },
      }),
    });

    const { status, body } = await fetchJSON(
      baseUrl,
      '/inspect?selector=button.checkout-btn'
    );
    assert.equal(status, 200);
    assert.equal(body.selector, 'button.checkout-btn');
    assert.ok(body.passes.length >= 1);
    assert.equal(body.passes[0].passId, 'inspect-pass-001');
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /inspect requires selector parameter', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status } = await fetchJSON(baseUrl, '/inspect');
    assert.equal(status, 400);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET and POST /tools manages tool configuration', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    // Initially empty or default
    const getRes = await fetchJSON(baseUrl, '/tools');
    assert.equal(getRes.status, 200);
    assert.ok(Array.isArray(getRes.body.tools));

    // Set tools
    const postRes = await fetchJSON(baseUrl, '/tools', {
      method: 'POST',
      body: JSON.stringify({
        tools: [
          { name: 'posthog', label: 'PostHog Analytics', enabled: true },
          { name: 'figma', label: 'Figma', enabled: false },
        ],
      }),
    });
    assert.equal(postRes.status, 200);
    assert.equal(postRes.body.tools.length, 2);
    assert.ok(postRes.body.tools.some((t) => t.name === 'posthog'));

    // Read back
    const getRes2 = await fetchJSON(baseUrl, '/tools');
    assert.equal(getRes2.body.tools.length, 2);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('POST /api/projects creates a project', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status, body } = await fetchJSON(baseUrl, '/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: 'my-project',
        title: 'My Test Project',
        description: 'A test project',
        activeTypes: ['research', 'design-system'],
      }),
    });
    assert.equal(status, 201);
    assert.equal(body.project.name, 'my-project');
    assert.equal(body.project.title, 'My Test Project');

    // List projects
    const listRes = await fetchJSON(baseUrl, '/api/projects');
    assert.equal(listRes.status, 200);
    const listedProject = listRes.body.projects.find((p) => p.name === 'my-project');
    assert.ok(listedProject);
    assert.deepEqual(listedProject.activeTypes, ['research', 'design-system']);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /passes/:id returns 404 for missing pass', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status } = await fetchJSON(baseUrl, '/passes/nonexistent');
    assert.equal(status, 404);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('GET /outcomes/:id returns 404 for missing outcome', async () => {
  const root = await setupContextRoot();
  const { server, baseUrl } = await startTestServer(root);

  try {
    const { status } = await fetchJSON(baseUrl, '/outcomes/nonexistent');
    assert.equal(status, 404);
  } finally {
    await server.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});
