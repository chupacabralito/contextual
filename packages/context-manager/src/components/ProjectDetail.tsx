// =============================================================================
// ProjectDetail
// =============================================================================
// Shows project brief, active context types, and pass history when a project
// is selected in the sidebar. Appears in the right panel (replacing the
// type detail view).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import { CONTEXT_TYPES, TYPE_LABELS } from '../hooks/useCorpus.js';
import type { ContextType } from '../hooks/useCorpus.js';
import { PasteZone } from './PasteZone.js';
import { OutcomeCard } from './OutcomeCard.js';

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

interface ProjectBrief {
  name: string;
  title: string;
  description: string;
  createdAt: string;
  lastActivityAt: string;
  activeTypes: ContextType[];
  body?: string;
}

interface ProjectOutcomeRecord {
  id: string;
  passId: string;
  timestamp: string;
  status: string;
}

interface ProjectDetailData {
  brief: ProjectBrief;
  passCount: number;
  outcomeCount?: number;
  passes: PassRecord[];
  outcomes?: ProjectOutcomeRecord[];
}

interface SourceEntry {
  filename: string;
  type: ContextType;
  preview: string;
  size: number;
  addedAt: string;
}

interface ProjectDetailProps {
  projectName: string;
  onSelectType: (type: ContextType) => void;
  onPaste?: (content: string, type: ContextType, label?: string) => Promise<void>;
  onDeleteSource?: (type: ContextType, filename: string) => Promise<void>;
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ProjectDetail({ projectName, onSelectType, onPaste, onDeleteSource }: ProjectDetailProps) {
  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPasses, setExpandedPasses] = useState<Set<string>>(new Set());
  const [detailTab, setDetailTab] = useState<'sources' | 'passes' | 'outcomes'>('sources');
  const [projectSources, setProjectSources] = useState<SourceEntry[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(projectName)}`);
      if (!res.ok) throw new Error(`Failed to load project: ${res.status}`);
      const json = await res.json() as ProjectDetailData;
      setData(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  // Fetch sources for the project's active context types
  const activeTypes = useMemo(() => data?.brief.activeTypes ?? [], [data]);

  useEffect(() => {
    let active = true;

    async function fetchSources() {
      setSourcesLoading(true);
      const typesToFetch = activeTypes.length > 0 ? activeTypes : CONTEXT_TYPES;
      const items: SourceEntry[] = [];

      try {
        const results = await Promise.all(
          typesToFetch.map(async (type) => {
            try {
              const res = await apiFetch(`/api/corpus/${type}/sources`);
              if (!res.ok) return [];
              const json = await res.json() as { sources: Array<{ filename: string; size: number; preview: string; addedAt: string }> };
              return (json.sources ?? []).map((s) => ({
                filename: s.filename,
                type,
                preview: s.preview?.slice(0, 200) ?? '',
                size: s.size,
                addedAt: s.addedAt,
              }));
            } catch {
              return [];
            }
          })
        );

        for (const batch of results) {
          items.push(...batch);
        }

        items.sort((a, b) => {
          const ta = new Date(a.addedAt).getTime();
          const tb = new Date(b.addedAt).getTime();
          return tb - ta;
        });
      } catch {
        // Non-critical
      }

      if (active) {
        setProjectSources(items);
        setSourcesLoading(false);
      }
    }

    void fetchSources();
    return () => { active = false; };
  }, [activeTypes]);

  if (isLoading) {
    return (
      <div className="project-detail">
        <div className="loading">Loading project...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="project-detail">
        <div className="project-detail-error">{error ?? 'Project not found'}</div>
      </div>
    );
  }

  const { brief, passes, outcomes } = data;
  const projectOutcomes = outcomes ?? [];

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="project-detail-header">
        <h2>{brief.title}</h2>
        <span className="muted">Created {formatDate(brief.createdAt)}</span>
      </div>

      {/* Description */}
      {brief.description && (
        <p className="project-detail-description">{brief.description}</p>
      )}

      {/* Project Brief body */}
      {brief.body && (
        <div className="project-brief">
          <div className="project-brief-header">
            <h3>Project Brief</h3>
          </div>
          <pre className="project-brief-content">{brief.body}</pre>
        </div>
      )}

      {/* Inline add context */}
      {onPaste && (
        <PasteZone onSubmit={onPaste} />
      )}

      {/* Active context type chips */}
      {brief.activeTypes.length > 0 && (
        <div className="project-detail-types">
          <h4>Active Context</h4>
          <div className="project-detail-type-chips">
            {brief.activeTypes.map((type) => (
              <button
                key={type}
                type="button"
                className="type-chip"
                onClick={() => onSelectType(type)}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabbed Sources / Passes */}
      <div className="home-tabs">
        <div className="home-tabs-bar">
          <button
            type="button"
            className={`home-tab${detailTab === 'sources' ? ' active' : ''}`}
            onClick={() => setDetailTab('sources')}
          >
            Sources
            <span className="home-tab-count">{projectSources.length}</span>
          </button>
          <button
            type="button"
            className={`home-tab${detailTab === 'passes' ? ' active' : ''}`}
            onClick={() => setDetailTab('passes')}
          >
            Passes
            <span className="home-tab-count">{passes.length}</span>
          </button>
          <button
            type="button"
            className={`home-tab${detailTab === 'outcomes' ? ' active' : ''}`}
            onClick={() => setDetailTab('outcomes')}
          >
            Outcomes
            <span className="home-tab-count">{projectOutcomes.length}</span>
          </button>
        </div>

        {/* Sources tab */}
        {detailTab === 'sources' && (
          <div className="all-sources">
            {sourcesLoading ? (
              <div className="loading">Loading sources...</div>
            ) : projectSources.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No sources yet for this project.</p>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Add source material via the context type views.
                </p>
              </div>
            ) : (
              <div className="all-sources-list">
                {projectSources.map((item) => {
                  const itemKey = `${item.type}-${item.filename}`;
                  const isConfirming = confirmDelete === itemKey;
                  return (
                    <div key={itemKey} className={`all-sources-item-row${isConfirming ? ' confirming' : ''}`}>
                      <button
                        type="button"
                        className="all-sources-item"
                        onClick={() => onSelectType(item.type)}
                      >
                        <div className="all-sources-item-header">
                          <span className="all-sources-item-type">
                            {TYPE_LABELS[item.type]}
                          </span>
                          <span className="all-sources-item-name">{item.filename}</span>
                          <span className="all-sources-item-size">{formatSize(item.size)}</span>
                        </div>
                        {item.preview && (
                          <div className="all-sources-item-preview">{item.preview}</div>
                        )}
                      </button>
                      {onDeleteSource && (
                        <>
                          {!isConfirming ? (
                            <button
                              type="button"
                              className="all-sources-item-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(itemKey);
                              }}
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
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="source-delete-confirm"
                                onClick={() => {
                                  void onDeleteSource(item.type, item.filename);
                                  setConfirmDelete(null);
                                  setProjectSources((prev) =>
                                    prev.filter((s) => !(s.type === item.type && s.filename === item.filename))
                                  );
                                }}
                              >
                                Confirm
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Passes tab */}
        {detailTab === 'passes' && (
          <div className="home-passes">
            {passes.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No passes yet.</p>
              </div>
            ) : (
              <div className="home-passes-list">
                {passes.map((pass) => {
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
                              <p className="pass-instruction-text">
                                {inst.rawText}
                              </p>
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

        {/* Outcomes tab */}
        {detailTab === 'outcomes' && (
          <div className="home-outcomes">
            {projectOutcomes.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No outcomes yet for this project.</p>
              </div>
            ) : (
              <div className="home-outcomes-list">
                {projectOutcomes.map((outcome) => (
                  <OutcomeCard
                    key={outcome.id}
                    outcome={outcome}
                    showProject={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
