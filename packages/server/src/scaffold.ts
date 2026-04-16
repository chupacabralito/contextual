// =============================================================================
// Project Scaffold
// =============================================================================
// Creates the standard context folder structure for a new project.
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { ScaffoldRequest, ScaffoldResponse, ContextType } from '@contextualapp/shared';
import { DEFAULT_CONTEXT_FOLDERS, DEFAULT_LEARNED_FOLDERS } from '@contextualapp/shared';

const README_CONTENT: Record<ContextType, string> = {
  research: 'User interviews, findings, pain points, usability studies',
  taste: 'Inspiration, brand feeling, anti-patterns, design principles',
  strategy: 'Vision, success metrics, requirements, product goals',
  'design-system': 'Components, patterns, specifications, tokens',
  stakeholders: 'Feedback logs, priorities, decisions, meeting notes',
  technical: 'Architecture considerations, technical constraints, API specs',
  business: 'Business requirements, models, revenue considerations',
};

const LEARNED_INDEX_CONTENT = `# Learned Policy

This directory stores distilled operator policy derived from completed passes.

- \`operator-preferences/\` captures durable approval patterns and stylistic preferences.
- \`ui-patterns/\` stores reusable UI decisions that should inform future passes.
- \`tool-routing/\` records which tools or data sources should be used for specific work.
- \`project-decisions/\` stores project-specific decisions that should survive chat history.
`;

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureFlywheelArtifacts(projectPath: string): Promise<void> {
  await Promise.all(
    DEFAULT_CONTEXT_FOLDERS.map((folder) =>
      fs.mkdir(path.join(projectPath, folder), { recursive: true })
    )
  );

  await fs.mkdir(path.join(projectPath, 'passes'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'outcomes'), { recursive: true });

  const learnedDir = path.join(projectPath, 'learned');
  await fs.mkdir(learnedDir, { recursive: true });

  await Promise.all(
    DEFAULT_LEARNED_FOLDERS.map((folder) =>
      fs.mkdir(path.join(learnedDir, folder), { recursive: true })
    )
  );

  const learnedIndexPath = path.join(learnedDir, 'INDEX.md');
  if (!(await exists(learnedIndexPath))) {
    await fs.writeFile(learnedIndexPath, LEARNED_INDEX_CONTENT, 'utf8');
  }
}

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

    await ensureFlywheelArtifacts(projectPath);

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
