import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceDir = path.join(repoRoot, 'packages', 'context-manager', 'dist');
const destinationDir = path.join(repoRoot, 'packages', 'server', 'dist', 'context-manager');

await fs.rm(destinationDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(destinationDir), { recursive: true });
await fs.cp(sourceDir, destinationDir, { recursive: true });
