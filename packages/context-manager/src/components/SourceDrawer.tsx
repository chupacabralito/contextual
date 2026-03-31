// =============================================================================
// SourceDrawer
// =============================================================================
// Shows raw source files for the selected context type. Appears as a panel
// alongside the compiled view. Supports viewing, adding, and deleting sources.
// =============================================================================

import { useState } from 'react';
import type { SourceFile } from '../hooks/useSources.js';
import type { ContextType } from '../hooks/useCorpus.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';

interface SourceDrawerProps {
  type: ContextType;
  sources: SourceFile[];
  isLoading: boolean;
  error: string | null;
  onAddSource: () => void;
  onDeleteSource: (filename: string) => void;
  onViewSource: (filename: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function SourceDrawer({
  type,
  sources,
  isLoading,
  error,
  onAddSource,
  onDeleteSource,
  onViewSource,
}: SourceDrawerProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const label = TYPE_LABELS[type];

  const handleDelete = (filename: string) => {
    if (confirmDelete === filename) {
      onDeleteSource(filename);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(filename);
    }
  };

  return (
    <div className="source-drawer">
      <div className="source-drawer-header">
        <h3>{label} Sources</h3>
        <button type="button" className="primary" onClick={onAddSource}>
          + Add Source
        </button>
      </div>

      {isLoading && <div className="loading">Loading sources...</div>}

      {error && <div className="error">{error}</div>}

      {!isLoading && sources.length === 0 && (
        <div className="empty-state">
          <p className="muted">No raw sources yet.</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Paste content, import from another project, or drop files here to add source material
            that can be compiled into structured context.
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="source-list">
          {sources.map((source) => (
            <div key={source.filename} className="source-item">
              <button
                type="button"
                className="source-item-main"
                onClick={() => onViewSource(source.filename)}
              >
                <span className="source-item-name">{source.filename}</span>
                <span className="source-item-meta">
                  {formatSize(source.size)} &middot; {formatDate(source.addedAt)}
                </span>
                {source.preview && (
                  <span className="source-item-preview">{source.preview}</span>
                )}
              </button>
              <button
                type="button"
                className={`source-item-delete ${confirmDelete === source.filename ? 'confirm' : ''}`}
                onClick={() => handleDelete(source.filename)}
                title={confirmDelete === source.filename ? 'Click again to confirm' : 'Delete source'}
              >
                {confirmDelete === source.filename ? 'Confirm' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
