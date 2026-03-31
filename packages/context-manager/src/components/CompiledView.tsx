// =============================================================================
// CompiledView
// =============================================================================
// Displays the compiled markdown content for a context type. Shows section
// headers with token counts, and allows inline editing of the compiled file.
// =============================================================================

import { useCallback, useState } from 'react';
import type { CompiledFileMeta, SectionMeta } from '../hooks/useCorpus.js';
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

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

function SectionHeader({ section, index }: { section: SectionMeta; index: number }) {
  return (
    <div className="section-header">
      <span className="section-index">{index + 1}</span>
      <span className="section-title">{section.title}</span>
      <span className="section-tokens">{formatTokens(section.tokenEstimate)} tokens</span>
    </div>
  );
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

  if (error) {
    return (
      <div className="compiled-view">
        <div className="error">{error}</div>
      </div>
    );
  }

  // No compiled file yet
  if (!meta || content === null) {
    return (
      <div className="compiled-view">
        <div className="compiled-view-header">
          <h3>{label} Context</h3>
        </div>
        <div className="empty-state">
          <p className="muted">No compiled context file yet.</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Add raw sources, then compile them into a structured context file.
            The compiler will organize and densify your source material into
            sections with clear headings.
          </p>
          <button type="button" className="primary" onClick={startEditing}>
            Create Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="compiled-view">
      <div className="compiled-view-header">
        <div>
          <h3>{meta.title || `${label} Context`}</h3>
          <span className="compiled-meta muted">
            {meta.sections.length} sections &middot;{' '}
            {formatTokens(meta.totalTokenEstimate)} tokens &middot;{' '}
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

      {/* Section table of contents */}
      {!isEditing && meta.sections.length > 0 && (
        <div className="section-toc">
          {meta.sections.map((section, index) => (
            <SectionHeader key={section.title} section={section} index={index} />
          ))}
        </div>
      )}

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
