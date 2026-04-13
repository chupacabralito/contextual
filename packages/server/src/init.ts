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
import { ensureFlywheelArtifacts } from './scaffold.js';
import { DEFAULT_CONTEXT_FOLDERS } from '@contextual/shared';
import type { ContextType } from '@contextual/shared';

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

import { ContextualProvider } from '@contextual/react';
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
  return `import { ContextualProvider } from '@contextual/react';
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
  const candidates = [
    `${base}/App.tsx`,
    `${base}/App.jsx`,
    `${base}/App.js`,
    `${base}/main.tsx`,
    `${base}/main.jsx`,
    `${base}/main.js`,
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

// -----------------------------------------------------------------------------
// Dependency management
// -----------------------------------------------------------------------------

/**
 * Resolve the path from the target project back to the contextual monorepo packages.
 * Returns file: protocol links for local development.
 */
function resolveContextualDeps(
  projectDir: string,
  contextualRoot: string,
): { react: string; shared: string } {
  const reactPkg = path.relative(projectDir, path.join(contextualRoot, 'packages', 'react'));
  const sharedPkg = path.relative(projectDir, path.join(contextualRoot, 'packages', 'shared'));
  return {
    react: `file:${reactPkg}`,
    shared: `file:${sharedPkg}`,
  };
}

/**
 * Add Contextual dependencies to the target project's package.json.
 */
async function addDependencies(
  packageJsonPath: string,
  pkg: Record<string, unknown>,
  deps: { react: string; shared: string },
): Promise<boolean> {
  const existing = (pkg.dependencies ?? {}) as Record<string, string>;

  if (existing['@contextual/react'] && existing['@contextual/shared']) {
    return false; // already present
  }

  existing['@contextual/react'] = deps.react;
  existing['@contextual/shared'] = deps.shared;

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
// Main init orchestrator
// -----------------------------------------------------------------------------

export interface InitOptions {
  /** Absolute path to the target project directory */
  projectDir: string;
  /** Absolute path to the contextual monorepo root */
  contextualRoot: string;
  /** Optional project name override */
  projectName?: string;
}

export interface InitResult {
  framework: Framework;
  projectName: string;
  contextRoot: string;
  overlayPath: string | null;
  layoutModified: boolean;
  depsAdded: boolean;
  steps: string[];
}

export async function init(options: InitOptions): Promise<InitResult> {
  const { projectDir, contextualRoot } = options;
  const steps: string[] = [];

  // Safety: don't run init inside the contextual monorepo itself
  const resolvedProject = path.resolve(projectDir);
  const resolvedContextual = path.resolve(contextualRoot);
  if (resolvedProject === resolvedContextual || resolvedProject.startsWith(resolvedContextual + path.sep)) {
    throw new Error(
      `Cannot init inside the contextual monorepo (${resolvedContextual}). ` +
      `Run this from your target project directory instead.`,
    );
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

  // Step 3: Add dependencies
  const depLinks = resolveContextualDeps(projectDir, contextualRoot);
  const depsAdded = await addDependencies(
    project.packageJsonPath,
    project.packageJson,
    depLinks,
  );
  steps.push(
    depsAdded
      ? 'Added @contextual/react and @contextual/shared to package.json'
      : '@contextual/react and @contextual/shared already in package.json',
  );

  // Step 4: Generate overlay component
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

    // Step 5: Inject into layout
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

    // For Vite we don't auto-inject — the entry patterns are too varied
    steps.push(
      'Wrap your root component with <ContextualOverlay> in App.tsx or main.tsx',
    );
  }

  return {
    framework: project.framework,
    projectName,
    contextRoot,
    overlayPath,
    layoutModified,
    depsAdded,
    steps,
  };
}
