// =============================================================================
// Project Scaffold
// =============================================================================
// Creates the standard context folder structure for a new project.
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { ScaffoldRequest, ScaffoldResponse, ContextType } from '@contextual/shared';
import { DEFAULT_CONTEXT_FOLDERS } from '@contextual/shared';

const README_CONTENT: Record<ContextType, string> = {
  research: 'User interviews, findings, pain points, usability studies',
  taste: 'Inspiration, brand feeling, anti-patterns, design principles',
  strategy: 'Vision, success metrics, requirements, product goals',
  'design-system': 'Components, patterns, specifications, tokens',
  stakeholders: 'Feedback logs, priorities, decisions, meeting notes',
  technical: 'Architecture considerations, technical constraints, API specs',
  business: 'Business requirements, models, revenue considerations',
};

/**
 * Scaffold a new project with the standard context folder structure.
 */
export async function scaffold(request: ScaffoldRequest): Promise<ScaffoldResponse> {
  const projectName = request.projectName.trim();
  const basePath = request.basePath.trim();

  if (!projectName || !basePath) {
    throw new Error('projectName and basePath are required');
  }

  const projectPath = path.resolve(basePath, projectName);

  try {
    await fs.access(projectPath);
    throw new Error(`Project directory already exists: ${projectPath}`);
  } catch (error) {
    const accessError = error as NodeJS.ErrnoException;
    if (accessError.code !== 'ENOENT') {
      throw accessError;
    }
  }

  await fs.mkdir(projectPath, { recursive: false });

  try {
    // Create context type folders with README files
    await Promise.all(
      DEFAULT_CONTEXT_FOLDERS.map(async (folder) => {
        const folderPath = path.join(projectPath, folder);
        await fs.mkdir(folderPath);
        await fs.writeFile(
          path.join(folderPath, 'README.md'),
          `# ${folder}\n\n${README_CONTENT[folder]}\n`,
          'utf8'
        );
      })
    );

    // Create /passes folder for pass persistence
    await fs.mkdir(path.join(projectPath, 'passes'));

    // Create empty tools.json for tool configuration
    await fs.writeFile(
      path.join(projectPath, 'tools.json'),
      '[]',
      'utf8'
    );
  } catch (error) {
    await fs.rm(projectPath, { recursive: true, force: true });
    throw error;
  }

  return {
    projectPath,
    createdFolders: [...DEFAULT_CONTEXT_FOLDERS],
  };
}
