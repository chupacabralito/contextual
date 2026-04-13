// =============================================================================
// SourceDrawer
// =============================================================================
// Shows raw source files and relevant passes for the selected context type.
// Tabbed UI: Sources | Passes (filtered by context type relevance).
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import type { SourceFile } from '../hooks/useSources.js';
import type { ContextType } from '../hooks/useCorpus.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';

interface PassInstruction {
  elementLabel: string;
  rawText: string;
}

interface PassRecord {
  id: string;
  timestamp: string;
  instructionCount: number;
  instructions: PassInstruction[];
}

interface SourceDrawerProps {
  type: ContextType;
  sources: SourceFile[];
  isLoading: boolean;
  error: string | null;
  onAddSource: () => void;
  onDeleteSource: (filename: string) => void;
  onViewSource: (filename: string) => void;
  passes?: PassRecord[];
  passesLoading?: boolean;
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** Check if a pass has any instruction relevant to the given context type */
function passMatchesType(pass: PassRecord, type: ContextType): boolean {
  const label = TYPE_LABELS[type].toLowerCase();
  // Also match the slug (e.g. "design-system" → "design system")
  const slug = type.toLowerCase().replace(/-/g, ' ');

  for (const inst of pass.instructions) {
    const text = `${inst.elementLabel} ${inst.rawText}`.toLowerCase();
    if (text.includes(label) || text.includes(slug) || text.includes(type)) {
      return true;
    }
  }
  return false;
}

export function SourceDrawer({
  type,
  sources,
  isLoading,
  error: _error,
  onAddSource: _onAddSource,
  onDeleteSource,
  onViewSource,
  passes = [],
  passesLoading = false,
}: SourceDrawerProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sources' | 'passes'>('sources');
  const [expandedPasses, setExpandedPasses] = useState<Set<string>>(new Set());
  const label = TYPE_LABELS[type];

  const handleDeleteConfirm = (filename: string) => {
    onDeleteSource(filename);
    setConfirmDelete(null);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const togglePass = useCallback((passId: string) => {
    setExpandedPasses((prev) => {
      const next = new Set(prev);
      if (next.has(passId)) {
        next.delete(passId);
      } else {
        next.add(passId);
      }
      return next;
    });
  }, []);

  // Filter passes to only those relevant to this context type
  const filteredPasses = useMemo(
    () => passes.filter((p) => passMatchesType(p, type)),
    [passes, type]
  );

  return (
    <div className="source-drawer">
      {/* Tab bar */}
      <div className="home-tabs-bar">
        <button
          type="button"
          className={`home-tab${activeTab === 'sources' ? ' active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          Sources
          <span className="home-tab-count">{sources.length}</span>
        </button>
        <button
          type="button"
          className={`home-tab${activeTab === 'passes' ? ' active' : ''}`}
          onClick={() => setActiveTab('passes')}
        >
          Passes
          <span className="home-tab-count">{filteredPasses.length}</span>
        </button>
      </div>

      {/* Sources tab */}
      {activeTab === 'sources' && (
        <>
          {isLoading && <div className="loading muted">Loading sources...</div>}

          {!isLoading && sources.length === 0 && (
            <div className="empty-state">
              <p className="muted">No raw sources yet.</p>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Drop files, paste content, or add .md files to the folder directly.
                Sources are compiled automatically.
              </p>
            </div>
          )}

          {sources.length > 0 && (
            <div className="source-list">
              {sources.map((source) => {
                const isConfirming = confirmDelete === source.filename;
                return (
                  <div key={source.filename} className={`source-item${isConfirming ? ' confirming' : ''}`}>
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
                    {!isConfirming ? (
                      <button
                        type="button"
                        className="source-item-delete"
                        onClick={() => setConfirmDelete(source.filename)}
                        title="Remove source"
                        aria-label="Remove source"
                      >
                        &times;
                      </button>
                    ) : (
                      <div className="source-item-delete-actions">
                        <button
                          type="button"
                          className="source-delete-cancel"
                          onClick={handleDeleteCancel}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="source-delete-confirm"
                          onClick={() => handleDeleteConfirm(source.filename)}
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Passes tab */}
      {activeTab === 'passes' && (
        <div className="home-passes">
          {passesLoading ? (
            <div className="loading">Loading passes...</div>
          ) : filteredPasses.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No passes related to {label} yet.</p>
            </div>
          ) : (
            <div className="home-passes-list">
              {filteredPasses.map((pass) => {
                const isExpanded = expandedPasses.has(pass.id);
                const instructions = pass.instructions ?? [];
                return (
                  <div key={pass.id} className={`project-detail-pass-item${isExpanded ? ' expanded' : ''}`}>
                    <button
                      type="button"
                      className="project-detail-pass-toggle"
                      onClick={() => togglePass(pass.id)}
                    >
                      <span className="project-detail-pass-chevron">
                        {isExpanded ? '\u25BC' : '\u25B6'}
                      </span>
                      <span className="project-detail-pass-time">
                        {formatTime(pass.timestamp)}
                      </span>
                      <span className="project-detail-pass-count">
                        {pass.instructionCount} instruction{pass.instructionCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                    {isExpanded && instructions.length > 0 && (
                      <div className="project-detail-pass-instructions">
                        {instructions.map((inst, idx) => (
                          <div key={idx} className="pass-instruction">
                            <span className="pass-instruction-element">
                              {inst.elementLabel}
                            </span>
                            <p className="pass-instruction-text">{inst.rawText}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && instructions.length === 0 && (
                      <p className="muted pass-instruction-empty">No instruction details available.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
