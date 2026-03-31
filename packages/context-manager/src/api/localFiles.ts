import type {
  ContextFilePreview,
  ContextRootResponse,
  ContextTypeGroup,
  PreviousProjectsResponse,
} from '../types.js';
import { fetchCompiledFile, fetchCorpus } from './corpus.js';

export async function fetchContextRoot(): Promise<ContextRootResponse> {
  const corpus = await fetchCorpus();

  const groups = await Promise.all(
    corpus.types.map(async (entry: (typeof corpus.types)[number]): Promise<ContextTypeGroup> => {
      let files: ContextFilePreview[] = [];

      if (entry.exists) {
        try {
          const compiled = await fetchCompiledFile(entry.type);
          files = [
            {
              relativePath: `${entry.type}/compiled.md`,
              fileName: 'compiled.md',
              summary: `${compiled.meta.sections.length} sections, ${compiled.meta.sourceCount} source files`,
              preview: compiled.content.slice(0, 400),
            },
          ];
        } catch {
          files = [];
        }
      }

      return {
        type: entry.type,
        fileCount: entry.sourceCount + (entry.exists ? 1 : 0),
        summary: entry.exists
          ? `Compiled corpus present with ${entry.sourceCount} source file${entry.sourceCount === 1 ? '' : 's'}.`
          : 'No compiled corpus yet.',
        files,
      };
    })
  );

  return {
    contextRoot: corpus.contextRoot,
    projectPath: corpus.contextRoot,
    previousProjectsPath: '',
    groups,
  };
}

export async function fetchPreviousProjects(): Promise<PreviousProjectsResponse> {
  return { projects: [] };
}
