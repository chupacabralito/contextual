import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { scaffold } from '../dist/scaffold.js';

test('scaffold creates the standard context folder structure with READMEs', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextual-scaffold-'));

  try {
    const result = await scaffold({
      projectName: 'alpha-project',
      basePath: tempRoot,
    });

    assert.equal(result.projectPath, path.join(tempRoot, 'alpha-project'));
    assert.deepEqual(result.createdFolders, [
      'research',
      'taste',
      'strategy',
      'design-system',
      'stakeholders',
    ]);

    for (const folder of result.createdFolders) {
      const readmePath = path.join(result.projectPath, folder, 'README.md');
      const content = await fs.readFile(readmePath, 'utf8');
      assert.match(content, new RegExp(`^# ${folder}`, 'm'));
      assert.ok(content.trim().length > folder.length);
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('scaffold rejects when the target project already exists', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextual-scaffold-'));
  const existingProject = path.join(tempRoot, 'existing-project');
  await fs.mkdir(existingProject);

  try {
    await assert.rejects(
      () =>
        scaffold({
          projectName: 'existing-project',
          basePath: tempRoot,
        }),
      /already exists/
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
