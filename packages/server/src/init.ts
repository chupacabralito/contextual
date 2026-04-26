// =============================================================================
// contextual init
// =============================================================================
// One-command onboarding: detects the target project's framework, scaffolds
// the .contextual folder, adds dependencies, generates the overlay component,
// and injects it into the root layout.
//
// Usage:
//   contextual-server init --project-dir /path/to/my-app
//   contextual-server init                                # uses cwd
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execSync } from 'node:child_process';
import { ensureFlywheelArtifacts } from './scaffold.js';
import { writeProjectConfig } from './config.js';
import { DEFAULT_CONTEXT_FOLDERS } from '@contextualapp/shared';
import type { ContextType } from '@contextualapp/shared';

// -----------------------------------------------------------------------------
// Framework detection
// -----------------------------------------------------------------------------

export type Framework = 'nextjs' | 'vite-react' | 'unknown';

interface DetectedProject {
  framework: Framework;
  projectName: string;
  packageJson: Record<string, unknown>;
  packageJsonPath: string;
  usesTypeScript: boolean;
  usesSrcDir: boolean;
}

/**
 * Read and parse the target project's package.json.
 */
async function readPackageJson(
  projectDir: string,
): Promise<{ data: Record<string, unknown>; filePath: string }> {
  const filePath = path.join(projectDir, 'package.json');
  const raw = await fs.readFile(filePath, 'utf8');
  return { data: JSON.parse(raw) as Record<string, unknown>, filePath };
}

/**
 * Check if a path exists on disk.
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the framework and structure of the target project.
 */
export async function detectProject(projectDir: string): Promise<DetectedProject> {
  const { data: pkg, filePath: packageJsonPath } = await readPackageJson(projectDir);
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };

  const projectName =
    typeof pkg.name === 'string'
      ? pkg.name.replace(/^@[^/]+\//, '') // strip scope
      : path.basename(projectDir);

  // Check for TypeScript
  const hasTsConfig = await exists(path.join(projectDir, 'tsconfig.json'));
  const usesTypeScript = hasTsConfig || 'typescript' in deps;

  // Detect framework
  let framework: Framework = 'unknown';
  if ('next' in deps) {
    framework = 'nextjs';
  } else if ('vite' in deps && ('react' in deps || 'react-dom' in deps)) {
    framework = 'vite-react';
  }

  // Check for src/ directory pattern
  const usesSrcDir =
    framework === 'nextjs'
      ? await exists(path.join(projectDir, 'src', 'app'))
      : await exists(path.join(projectDir, 'src'));

  return {
    framework,
    projectName,
    packageJson: pkg,
    packageJsonPath,
    usesTypeScript,
    usesSrcDir,
  };
}

// -----------------------------------------------------------------------------
// Overlay component generation
// -----------------------------------------------------------------------------

function generateOverlayComponent(projectName: string, usesTypeScript: boolean): string {
  const ext = usesTypeScript ? '' : ''; // content is the same, file ext differs
  return `'use client';

import { ContextualProvider } from '@contextualapp/react';
${usesTypeScript ? '' : '// @ts-ignore\n'}
export function ContextualOverlay({ children }${usesTypeScript ? ': { children: React.ReactNode }' : ''}) {
  // Only render in development — zero cost in production builds
  if (process.env.NODE_ENV !== 'development') {
    return <>{children}</>;
  }

  return (
    <ContextualProvider
      serverUrl="http://localhost:4700"
      project="${projectName}"
    >
      {children}
    </ContextualProvider>
  );
}
`;
}

function generateViteOverlayComponent(
  projectName: string,
  usesTypeScript: boolean,
): string {
  return `import { ContextualProvider } from '@contextualapp/react';
${usesTypeScript ? '' : '// @ts-ignore\n'}
export function ContextualOverlay({ children }${usesTypeScript ? ': { children: React.ReactNode }' : ''}) {
  // Only render in development — zero cost in production builds
  if (import.meta.env.MODE !== 'development') {
    return <>{children}</>;
  }

  return (
    <ContextualProvider
      serverUrl="http://localhost:4700"
      project="${projectName}"
    >
      {children}
    </ContextualProvider>
  );
}
`;
}

// -----------------------------------------------------------------------------
// Layout injection
// -----------------------------------------------------------------------------

/**
 * Find the root layout file for a Next.js app.
 */
async function findNextLayout(projectDir: string, usesSrcDir: boolean): Promise<string | null> {
  const candidates = usesSrcDir
    ? ['src/app/layout.tsx', 'src/app/layout.jsx', 'src/app/layout.js']
    : ['app/layout.tsx', 'app/layout.jsx', 'app/layout.js'];

  for (const candidate of candidates) {
    const fullPath = path.join(projectDir, candidate);
    if (await exists(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Find the root App/main file for a Vite+React app.
 */
async function findViteEntry(projectDir: string, usesSrcDir: boolean): Promise<string | null> {
  const base = usesSrcDir ? 'src' : '.';
  // Prioritize main.tsx (the Vite entry point where <App /> is rendered)
  // over App.tsx (the component itself) for auto-injection
  const candidates = [
    `${base}/main.tsx`,
    `${base}/main.jsx`,
    `${base}/main.js`,
    `${base}/App.tsx`,
    `${base}/App.jsx`,
    `${base}/App.js`,
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(projectDir, candidate);
    if (await exists(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Inject the ContextualOverlay import and wrapper into a Next.js layout.
 */
function injectIntoNextLayout(
  content: string,
  overlayRelativePath: string,
): { modified: string; injected: boolean } {
  // Already integrated?
  if (content.includes('ContextualOverlay')) {
    return { modified: content, injected: false };
  }

  // Add import after the last existing import
  const importStatement = `import { ContextualOverlay } from '${overlayRelativePath}';\n`;
  const lastImportIndex = content.lastIndexOf('\nimport ');
  let withImport: string;

  if (lastImportIndex !== -1) {
    // Find the end of the last import line
    const lineEnd = content.indexOf('\n', lastImportIndex + 1);
    withImport =
      content.slice(0, lineEnd + 1) + importStatement + content.slice(lineEnd + 1);
  } else {
    withImport = importStatement + content;
  }

  // Wrap {children} with <ContextualOverlay>
  // Match the pattern: {children} inside the body or a wrapper element
  const childrenPattern = /(\s*)\{children\}/;
  const match = withImport.match(childrenPattern);
  if (match) {
    const indent = match[1] || '            ';
    const wrapped = `${indent}<ContextualOverlay>\n${indent}  {children}\n${indent}</ContextualOverlay>`;
    const modified = withImport.replace(childrenPattern, wrapped);
    return { modified, injected: true };
  }

  return { modified: withImport, injected: false };
}

/**
 * Inject the ContextualOverlay import and wrapper into a Vite+React main.tsx.
 *
 * Targets the standard create-vite pattern:
 *   <StrictMode>
 *     <App />
 *   </StrictMode>
 *
 * Wraps <App /> with <ContextualOverlay>:
 *   <StrictMode>
 *     <ContextualOverlay>
 *       <App />
 *     </ContextualOverlay>
 *   </StrictMode>
 */
function injectIntoViteMain(
  content: string,
  overlayRelativePath: string,
): { modified: string; injected: boolean } {
  // Already integrated?
  if (content.includes('ContextualOverlay')) {
    return { modified: content, injected: false };
  }

  // Add import after the last existing import
  const importStatement = `import { ContextualOverlay } from '${overlayRelativePath}'\n`;
  const lastImportIndex = content.lastIndexOf('\nimport ');
  let withImport: string;

  if (lastImportIndex !== -1) {
    const lineEnd = content.indexOf('\n', lastImportIndex + 1);
    withImport =
      content.slice(0, lineEnd + 1) + importStatement + content.slice(lineEnd + 1);
  } else {
    withImport = importStatement + content;
  }

  // Strategy: find <App /> (or <App/>) and wrap it with <ContextualOverlay>
  const appPattern = /(\s*)<App\s*\/>/;
  const match = withImport.match(appPattern);
  if (match) {
    const indent = match[1] || '    ';
    const wrapped = `${indent}<ContextualOverlay>\n${indent}  <App />\n${indent}</ContextualOverlay>`;
    const modified = withImport.replace(appPattern, wrapped);
    return { modified, injected: true };
  }

  return { modified: withImport, injected: false };
}

// -----------------------------------------------------------------------------
// Dependency management
// -----------------------------------------------------------------------------

/** Default semver ranges for Contextual packages */
const DEFAULT_PACKAGE_VERSIONS = {
  react: '^0.1.2',
  shared: '^0.1.2',
};

/**
 * Add Contextual dependencies to the target project's package.json.
 * Uses standard npm semver ranges — no monorepo-relative file: links.
 */
async function addDependencies(
  packageJsonPath: string,
  pkg: Record<string, unknown>,
  versions: { react: string; shared: string },
): Promise<boolean> {
  const existing = (pkg.dependencies ?? {}) as Record<string, string>;

  // If both already present and not using file: links, skip
  const reactPresent = existing['@contextualapp/react'] && !existing['@contextualapp/react'].startsWith('file:');
  const sharedPresent = existing['@contextualapp/shared'] && !existing['@contextualapp/shared'].startsWith('file:');
  if (reactPresent && sharedPresent) {
    return false;
  }

  existing['@contextualapp/react'] = versions.react;
  existing['@contextualapp/shared'] = versions.shared;

  const updated = { ...pkg, dependencies: existing };
  await fs.writeFile(packageJsonPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return true;
}

// -----------------------------------------------------------------------------
// Context folder scaffold (reuses existing scaffold logic)
// -----------------------------------------------------------------------------

const README_CONTENT: Record<ContextType, string> = {
  research: 'User interviews, findings, pain points, usability studies',
  taste: 'Inspiration, brand feeling, anti-patterns, design principles',
  strategy: 'Vision, success metrics, requirements, product goals',
  'design-system': 'Components, patterns, specifications, tokens',
  stakeholders: 'Feedback logs, priorities, decisions, meeting notes',
  technical: 'Architecture considerations, technical constraints, API specs',
  business: 'Business requirements, models, revenue considerations',
};

async function scaffoldContextFolder(contextRoot: string): Promise<void> {
  await fs.mkdir(contextRoot, { recursive: true });

  // Create context type folders with READMEs (skip if they already exist)
  for (const folder of DEFAULT_CONTEXT_FOLDERS) {
    const folderPath = path.join(contextRoot, folder);
    if (!(await exists(folderPath))) {
      await fs.mkdir(folderPath, { recursive: true });
      await fs.writeFile(
        path.join(folderPath, 'README.md'),
        `# ${folder}\n\n${README_CONTENT[folder]}\n`,
        'utf8',
      );
    }
  }

  await ensureFlywheelArtifacts(contextRoot);

  // Create empty tools.json if it doesn't exist
  const toolsPath = path.join(contextRoot, 'tools.json');
  if (!(await exists(toolsPath))) {
    await fs.writeFile(toolsPath, '[]', 'utf8');
  }
}

// -----------------------------------------------------------------------------
// CLAUDE.md guidelines
// -----------------------------------------------------------------------------

const CONTEXTUAL_CLAUDE_MD_SECTION = `

## Contextual (Automated Passes)

When executing passes dispatched by Contextual, follow these rules:

- **Do NOT run production builds** (npm run build, next build, vite build, etc.) — the dev server is already running and a production build will corrupt its build cache, crashing the dev server.
- **Let HMR handle reloads** — the dev server will hot-reload your changes automatically. There is no need to verify builds manually.
- **Record the outcome** when finished — use the \`contextual-server record-outcome\` command provided in the pass prompt.
`;

const CONTEXTUAL_SECTION_MARKER = '## Contextual (Automated Passes)';

/**
 * Append Contextual agent guidelines to the project's CLAUDE.md.
 * Creates the file if it doesn't exist. Skips if the section is already present.
 */
async function appendClaudeMdGuidelines(projectDir: string, steps: string[]): Promise<void> {
  const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

  try {
    // Check if CLAUDE.md already exists and has the section
    let existingContent = '';
    try {
      existingContent = await fs.readFile(claudeMdPath, 'utf8');
    } catch {
      // File doesn't exist — we'll create it
    }

    if (existingContent.includes(CONTEXTUAL_SECTION_MARKER)) {
      steps.push('CLAUDE.md already has Contextual agent guidelines');
      return;
    }

    // Append the section
    const newContent = existingContent
      ? existingContent.trimEnd() + '\n' + CONTEXTUAL_CLAUDE_MD_SECTION
      : `# CLAUDE.md\n${CONTEXTUAL_CLAUDE_MD_SECTION}`;

    await fs.writeFile(claudeMdPath, newContent, 'utf8');
    steps.push(
      existingContent
        ? 'Appended Contextual agent guidelines to CLAUDE.md'
        : 'Created CLAUDE.md with Contextual agent guidelines',
    );
  } catch {
    steps.push('Warning: Could not update CLAUDE.md — please add Contextual guidelines manually');
  }
}

// -----------------------------------------------------------------------------
// Main init orchestrator
// -----------------------------------------------------------------------------

export interface InitOptions {
  /** Absolute path to the target project directory */
  projectDir: string;
  /** Optional: absolute path to the contextual monorepo root (for contributor dev only) */
  contextualRoot?: string;
  /** Optional project name override */
  projectName?: string;
  /** Optional explicit package versions (e.g. for local dev with file: links) */
  packageVersions?: { react: string; shared: string };
}

export interface InitResult {
  framework: Framework;
  projectName: string;
  contextRoot: string;
  overlayPath: string | null;
  layoutModified: boolean;
  depsAdded: boolean;
  depsInstalled: boolean;
  steps: string[];
}

export async function init(options: InitOptions): Promise<InitResult> {
  const { projectDir } = options;
  const steps: string[] = [];

  // Safety: don't run init inside the contextual monorepo itself
  if (options.contextualRoot) {
    const resolvedProject = path.resolve(projectDir);
    const resolvedContextual = path.resolve(options.contextualRoot);
    if (resolvedProject === resolvedContextual || resolvedProject.startsWith(resolvedContextual + path.sep)) {
      throw new Error(
        `Cannot init inside the contextual monorepo (${resolvedContextual}). ` +
        `Run this from your target project directory instead.`,
      );
    }
  }

  // Step 1: Detect framework
  const project = await detectProject(projectDir);
  const projectName = options.projectName ?? project.projectName;
  steps.push(`Detected ${project.framework} project: ${projectName}`);

  if (project.framework === 'unknown') {
    steps.push(
      'Warning: Could not detect framework. Scaffolding context folder only — you will need to integrate the overlay manually.',
    );
  }

  // Step 2: Scaffold .contextual folder
  const contextRoot = path.join(projectDir, '.contextual');
  const contextAlreadyExists = await exists(contextRoot);
  await scaffoldContextFolder(contextRoot);
  steps.push(
    contextAlreadyExists
      ? '.contextual/ folder already exists — ensured all subfolders are present'
      : 'Created .contextual/ folder with 7 context types + passes/outcomes/learned',
  );

  // Step 3: Write persisted config
  await writeProjectConfig({
    projectDir: path.resolve(projectDir),
    contextRoot: path.resolve(contextRoot),
    projectName,
  });
  steps.push('Wrote .contextual/config.json');

  // Step 4: Add dependencies (semver by default, file: links only if explicitly provided)
  const versions = options.packageVersions ?? DEFAULT_PACKAGE_VERSIONS;
  const depsAdded = await addDependencies(
    project.packageJsonPath,
    project.packageJson,
    versions,
  );
  if (depsAdded) {
    const usesFileLinks = versions.react.startsWith('file:');
    steps.push(
      usesFileLinks
        ? 'Added @contextualapp/react and @contextualapp/shared (local file: links for development)'
        : 'Added @contextualapp/react and @contextualapp/shared to package.json',
    );
  } else {
    steps.push('@contextualapp/react and @contextualapp/shared already in package.json');
  }

  // Step 5: Auto-install dependencies if added
  let depsInstalled = false;
  if (depsAdded) {
    try {
      steps.push('Installing dependencies...');
      execSync('npm install', { cwd: projectDir, stdio: 'pipe' });
      depsInstalled = true;
      steps.push('Installed @contextualapp/react and @contextualapp/shared');
    } catch {
      steps.push('Warning: npm install failed — please run `npm install` manually');
    }
  }

  // Step 6: Generate overlay component
  let overlayPath: string | null = null;
  let layoutModified = false;

  if (project.framework === 'nextjs') {
    // Determine where to put the component
    const componentsDir = project.usesSrcDir
      ? path.join(projectDir, 'src', 'components')
      : path.join(projectDir, 'components');
    await fs.mkdir(componentsDir, { recursive: true });

    const ext = project.usesTypeScript ? 'tsx' : 'jsx';
    overlayPath = path.join(componentsDir, `ContextualOverlay.${ext}`);

    if (await exists(overlayPath)) {
      steps.push(`ContextualOverlay.${ext} already exists — skipping`);
    } else {
      const overlayCode = generateOverlayComponent(projectName, project.usesTypeScript);
      await fs.writeFile(overlayPath, overlayCode, 'utf8');
      steps.push(`Created ${path.relative(projectDir, overlayPath)}`);
    }

    // Step 6: Inject into layout
    const layoutPath = await findNextLayout(projectDir, project.usesSrcDir);
    if (layoutPath) {
      const layoutContent = await fs.readFile(layoutPath, 'utf8');

      // Compute relative import path
      const layoutDir = path.dirname(layoutPath);
      const overlayImportBase = path.relative(layoutDir, overlayPath).replace(/\.[jt]sx?$/, '');
      const overlayImport = overlayImportBase.startsWith('.')
        ? overlayImportBase
        : `./${overlayImportBase}`;
      // Normalize to use @/ alias if inside src/ or at project root
      const useAtAlias = layoutContent.includes("from '@/") || layoutContent.includes('from "@/');
      const importPath = useAtAlias
        ? `@/${path.relative(project.usesSrcDir ? path.join(projectDir, 'src') : projectDir, overlayPath).replace(/\.[jt]sx?$/, '')}`
        : overlayImport;

      const { modified, injected } = injectIntoNextLayout(layoutContent, importPath);
      if (injected) {
        await fs.writeFile(layoutPath, modified, 'utf8');
        layoutModified = true;
        steps.push(`Injected ContextualOverlay into ${path.relative(projectDir, layoutPath)}`);
      } else if (layoutContent.includes('ContextualOverlay')) {
        steps.push(`${path.relative(projectDir, layoutPath)} already has ContextualOverlay`);
      } else {
        steps.push(
          `Could not auto-inject into layout — please manually wrap {children} with <ContextualOverlay> in ${path.relative(projectDir, layoutPath)}`,
        );
      }
    } else {
      steps.push('Could not find app/layout.tsx — please manually add ContextualOverlay');
    }
  } else if (project.framework === 'vite-react') {
    const componentsDir = project.usesSrcDir
      ? path.join(projectDir, 'src', 'components')
      : path.join(projectDir, 'components');
    await fs.mkdir(componentsDir, { recursive: true });

    const ext = project.usesTypeScript ? 'tsx' : 'jsx';
    overlayPath = path.join(componentsDir, `ContextualOverlay.${ext}`);

    if (await exists(overlayPath)) {
      steps.push(`ContextualOverlay.${ext} already exists — skipping`);
    } else {
      const overlayCode = generateViteOverlayComponent(projectName, project.usesTypeScript);
      await fs.writeFile(overlayPath, overlayCode, 'utf8');
      steps.push(`Created ${path.relative(projectDir, overlayPath)}`);
    }

    // Inject into main.tsx (the standard Vite entry point)
    const mainPath = await findViteEntry(projectDir, project.usesSrcDir);
    if (mainPath && path.basename(mainPath).startsWith('main')) {
      const mainContent = await fs.readFile(mainPath, 'utf8');

      // Compute relative import path from main.tsx to the overlay component
      const mainDir = path.dirname(mainPath);
      const overlayImportBase = path.relative(mainDir, overlayPath).replace(/\.[jt]sx?$/, '');
      const overlayImport = overlayImportBase.startsWith('.')
        ? overlayImportBase
        : `./${overlayImportBase}`;

      const { modified, injected } = injectIntoViteMain(mainContent, overlayImport);
      if (injected) {
        await fs.writeFile(mainPath, modified, 'utf8');
        layoutModified = true;
        steps.push(`Injected toolbar into ${path.relative(projectDir, mainPath)}`);
      } else if (mainContent.includes('ContextualOverlay')) {
        steps.push(`${path.relative(projectDir, mainPath)} already has toolbar`);
      } else {
        steps.push(
          `Could not auto-inject toolbar — please manually wrap <App /> with <ContextualOverlay> in ${path.relative(projectDir, mainPath)}`,
        );
      }
    } else {
      steps.push(
        'Could not find main.tsx — please manually wrap <App /> with <ContextualOverlay>',
      );
    }
  }

  // Step 7: Append Contextual agent guidelines to CLAUDE.md
  await appendClaudeMdGuidelines(projectDir, steps);

  return {
    framework: project.framework,
    projectName,
    contextRoot,
    overlayPath,
    layoutModified,
    depsAdded,
    depsInstalled,
    steps,
  };
}
