import { useState } from 'react';
import type { ContextType, RepositoryResponse } from '../types.js';
import { CONTEXT_TYPES } from '../types.js';

interface RepositoryViewProps {
  data: RepositoryResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function RepositoryView({ data, isLoading, error }: RepositoryViewProps) {
  const [filterType, setFilterType] = useState<ContextType | 'all'>('all');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  if (isLoading) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 6</p>
            <h2>Repository Browser</h2>
          </div>
        </div>
        <p className="muted">Loading repository...</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 6</p>
            <h2>Repository Browser</h2>
          </div>
        </div>
        <div className="error">{error ?? 'Failed to load repository'}</div>
      </section>
    );
  }

  const filteredFiles =
    filterType === 'all'
      ? data.files
      : data.files.filter((f) => f.type === filterType);

  // Group files by type for display
  const grouped = new Map<string, typeof data.files>();
  for (const file of filteredFiles) {
    const group = grouped.get(file.type) ?? [];
    group.push(file);
    grouped.set(file.type, group);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 6</p>
          <h2>Repository Browser</h2>
        </div>
        <p className="muted">
          {data.totalFiles} file{data.totalFiles !== 1 ? 's' : ''} in{' '}
          <code>{data.contextRoot}</code>
        </p>
      </div>

      <p className="muted" style={{ marginBottom: '1rem' }}>
        Browse all context files across the 5 local context repositories. These files are
        what the annotation tool searches when resolving <code>@research</code>,{' '}
        <code>@taste</code>, and other local context @mentions.
      </p>

      <div className="row gap-sm" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          className={`toggle ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
          type="button"
        >
          All ({data.totalFiles})
        </button>
        {CONTEXT_TYPES.map((type) => {
          const count = data.files.filter((f) => f.type === type).length;
          return (
            <button
              key={type}
              className={`toggle ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
              type="button"
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      <div className="stack-lg">
        {filteredFiles.length === 0 && (
          <div className="empty-state">
            <p className="muted">
              No files found{filterType !== 'all' ? ` in ${filterType}` : ''}. Add context
              files to the repository folders to make them available for annotation.
            </p>
          </div>
        )}

        {Array.from(grouped.entries()).map(([type, files]) => (
          <article className="card" key={type}>
            <div className="row gap-sm align-center" style={{ marginBottom: '0.75rem' }}>
              <h3>{type}</h3>
              <span className="badge">{files.length} files</span>
            </div>

            <div className="preview-list">
              {files.map((file) => {
                const isExpanded = expandedFile === file.relativePath;
                return (
                  <div className="preview-item" key={file.relativePath}>
                    <div className="row space-between align-center gap-md">
                      <div>
                        <strong>{file.fileName}</strong>
                        <span className="muted" style={{ marginLeft: '0.5rem' }}>
                          {file.relativePath}
                        </span>
                      </div>
                      <div className="row gap-sm align-center">
                        <span className="muted">{formatSize(file.size)}</span>
                        <button
                          className="secondary"
                          onClick={() =>
                            setExpandedFile(isExpanded ? null : file.relativePath)
                          }
                          type="button"
                        >
                          {isExpanded ? 'Hide' : 'Preview'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && <pre>{file.preview}</pre>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
