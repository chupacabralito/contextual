// =============================================================================
// CompiledView
// =============================================================================
// Displays the compiled markdown content for a context type. Shows total
// token count in the header, and allows inline editing of the compiled file.
// =============================================================================

import { useCallback, useState } from 'react';
import type { CompiledFileMeta } from '../hooks/useCorpus.js';
import type { ContextType } from '../hooks/useCorpus.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';

interface CompiledViewProps {
  type: ContextType;
  meta: CompiledFileMeta | null;
  content: string | null;
  isLoading: boolean;
  error: string | null;
  onUpdate: (content: string) => Promise<void>;
}

export function CompiledView({
  type,
  meta,
  content,
  isLoading,
  error,
  onUpdate,
}: CompiledViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const label = TYPE_LABELS[type];

  const startEditing = useCallback(() => {
    setEditContent(content ?? '');
    setIsEditing(true);
    setSaveError(null);
  }, [content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
    setSaveError(null);
  }, []);

  const saveEdits = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await onUpdate(editContent);
      setIsEditing(false);
      setEditContent('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [editContent, onUpdate]);

  if (isLoading) {
    return (
      <div className="compiled-view">
        <div className="loading">Loading compiled context...</div>
      </div>
    );
  }

  // No compiled file yet (or fetch error -- treat as empty, not a red error)
  if (error || !meta || content === null) {
    return (
      <div className="compiled-view">
        <div className="compiled-view-header">
          <h3>{label} Brief</h3>
        </div>
        <div className="empty-state">
          <p className="muted">No compiled context yet.</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Drop files or paste content and it will be compiled automatically.
            Files added to the folder outside the UI are also detected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="compiled-view">
      <div className="compiled-view-header">
        <div>
          <h3>{label} Brief</h3>
          <span className="compiled-meta muted">
            {meta.sections.length} sections &middot;{' '}
            {meta.sourceCount} sources compiled
          </span>
        </div>
        <div className="compiled-view-actions">
          {!isEditing ? (
            <button type="button" className="secondary" onClick={startEditing}>
              Edit
            </button>
          ) : (
            <>
              <button type="button" className="ghost" onClick={cancelEditing} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={saveEdits} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && <div className="error" style={{ marginBottom: '0.75rem' }}>{saveError}</div>}

      {/* Content display or editor */}
      {isEditing ? (
        <textarea
          className="compiled-editor"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={24}
          spellCheck={false}
        />
      ) : (
        <pre className="compiled-content">{content}</pre>
      )}
    </div>
  );
}
