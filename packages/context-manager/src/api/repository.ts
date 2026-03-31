import type { RepositoryFile, RepositoryResponse } from '../types.js';
import { fetchCompiledFile, fetchCorpus } from './corpus.js';
import { fetchSources } from './sources.js';

export async function fetchRepository(): Promise<RepositoryResponse> {
  const corpus = await fetchCorpus();
  const files: RepositoryFile[] = [];

  await Promise.all(
    corpus.types.map(async (entry: (typeof corpus.types)[number]) => {
      if (entry.exists) {
        try {
          const compiled = await fetchCompiledFile(entry.type);
          files.push({
            relativePath: `${entry.type}/compiled.md`,
            fileName: 'compiled.md',
            type: entry.type,
            size: compiled.content.length,
            preview: compiled.content.slice(0, 400),
          });
        } catch {
          // Ignore invalid compiled files in the compatibility view.
        }
      }

      try {
        const sourceList = await fetchSources(entry.type);
        for (const source of sourceList.sources) {
          files.push({
            relativePath: `${entry.type}/_sources/${source.filename}`,
            fileName: source.filename,
            type: entry.type,
            size: source.size,
            preview: source.preview,
          });
        }
      } catch {
        // Ignore source-list failures in the compatibility view.
      }
    })
  );

  return {
    contextRoot: corpus.contextRoot,
    files,
    totalFiles: files.length,
  };
}
