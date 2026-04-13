// =============================================================================
// Context Manager - Wispr-Inspired Corpus Home
// =============================================================================
// Two-panel layout:
//   Left sidebar:  Hierarchical tree (product + projects)
//   Center:        Paste zone + detail view (compiled doc + sources)
//
// At the home level (no type/project selected), the center shows the paste zone
// plus an "All Sources" list. When a type is selected, it shows the compiled
// doc + source drawer. When a project is selected, it shows the project detail.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api/client.js';
import { useCorpus } from './hooks/useCorpus.js';
import { useSources } from './hooks/useSources.js';
import { useCompiledFile } from './hooks/useCompiledFile.js';
import { useProjects } from './hooks/useProjects.js';
import { CorpusTree } from './components/CorpusTree.js';
import type { SidebarSelection } from './components/CorpusTree.js';
import { PasteZone } from './components/PasteZone.js';
import { SourceDrawer } from './components/SourceDrawer.js';
import { CompiledView } from './components/CompiledView.js';
import { AddSourceModal } from './components/AddSourceModal.js';
import { ImportModal } from './components/ImportModal.js';
import { DiscoverModal } from './components/DiscoverModal.js';
import { ProjectDetail } from './components/ProjectDetail.js';
import { ProductBriefView } from './components/ProductBriefView.js';
import { OutcomeCard } from './components/OutcomeCard.js';
import { NextStepsCard } from './components/NextStepsCard.js';
import type { ContextType } from './hooks/useCorpus.js';
import { CONTEXT_TYPES, TYPE_LABELS } from './hooks/useCorpus.js';

export function App() {
  const corpus = useCorpus();
  const projects = useProjects();
  const [selection, setSelection] = useState<SidebarSelection | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [_viewingSource, setViewingSource] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<'next-steps' | 'sources' | 'passes' | 'outcomes'>(
    'next-steps'
  );

  // Derived state from selection
  const selectedType = selection?.category ?? null;
  const activeProject = selection?.scope !== 'product' ? (selection?.scope ?? null) : null;

  // All sources (shown at home level)
  interface SourceEntry {
    filename: string;
    type: ContextType;
    preview: string;
    size: number;
    addedAt: string;
  }
  const [allSources, setAllSources] = useState<SourceEntry[]>([]);
  const [allSourcesLoading, setAllSourcesLoading] = useState(true);
  const [confirmDeleteHome, setConfirmDeleteHome] = useState<string | null>(null);

  const sources = useSources({ type: selectedType });
  const compiled = useCompiledFile({ type: selectedType });

  // Build all-sources list (shown at home level in center panel)
  useEffect(() => {
    let active = true;

    async function fetchAllSources() {
      setAllSourcesLoading(true);
      const items: SourceEntry[] = [];

      try {
        const results = await Promise.all(
          CONTEXT_TYPES.map(async (type) => {
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

        // Sort by date descending
        items.sort((a, b) => {
          const ta = new Date(a.addedAt).getTime();
          const tb = new Date(b.addedAt).getTime();
          return tb - ta;
        });
      } catch {
        // Non-critical; fail silently
      }

      if (active) {
        setAllSources(items);
        setAllSourcesLoading(false);
      }
    }

    void fetchAllSources();
    return () => { active = false; };
  }, [corpus.data]); // Re-fetch when corpus changes

  // Passes data (shown at home level in Passes tab)
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
  const [allPasses, setAllPasses] = useState<PassRecord[]>([]);
  const [allPassesLoading, setAllPassesLoading] = useState(true);
  const [expandedPasses, setExpandedPasses] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    let active = true;

    async function fetchPasses() {
      setAllPassesLoading(true);
      try {
        const res = await apiFetch('/api/corpus/passes');
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = await res.json() as { passes: PassRecord[] };
        if (active) setAllPasses(json.passes ?? []);
      } catch {
        // Non-critical
      } finally {
        if (active) setAllPassesLoading(false);
      }
    }

    void fetchPasses();
    return () => { active = false; };
  }, [corpus.data]); // Re-fetch when corpus changes

  // Outcomes data (shown at home level in Outcomes tab)
  interface OutcomeSummaryLocal {
    id: string;
    passId: string;
    timestamp: string;
    status: string;
    project?: string;
    affectedContextTypes?: string[];
    changedFileCount: number;
    writebackCount: number;
  }
  const [allOutcomes, setAllOutcomes] = useState<OutcomeSummaryLocal[]>([]);
  const [allOutcomesLoading, setAllOutcomesLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchOutcomes() {
      setAllOutcomesLoading(true);
      try {
        const res = await apiFetch('/api/corpus/outcomes');
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = await res.json() as { outcomes: OutcomeSummaryLocal[] };
        if (active) setAllOutcomes(json.outcomes ?? []);
      } catch {
        // Non-critical
      } finally {
        if (active) setAllOutcomesLoading(false);
      }
    }

    void fetchOutcomes();
    return () => { active = false; };
  }, [corpus.data]); // Re-fetch when corpus changes

  // Whether we're at the "home" level (product scope, no type selected)
  const isHome = !selectedType && !activeProject;

  const handleSelect = useCallback(
    (sel: SidebarSelection) => {
      setSelection(sel);
      setViewingSource(null);
    },
    []
  );

  const handlePaste = useCallback(
    async (content: string, type: ContextType, label?: string, filename?: string) => {
      const body: Record<string, string> = { content };
      if (label) body.label = label;
      if (filename) body.filename = filename;

      const res = await apiFetch(`/api/corpus/${type}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to add source: ${res.status}`);

      // Auto-compile the affected type after manual paste
      await apiFetch(`/api/corpus/${type}/compile`, { method: 'POST' }).catch(() => {});

      corpus.refetch();
      if (selectedType === type) {
        sources.refetch();
        compiled.refetch();
      }
    },
    [corpus, sources, compiled, selectedType]
  );

  const handleAddSource = useCallback(
    async (content: string, label?: string) => {
      if (!selectedType) return;
      await handlePaste(content, selectedType, label);
    },
    [selectedType, handlePaste]
  );

  const handleDeleteSource = useCallback(
    async (filename: string) => {
      try {
        await sources.deleteSource(filename);
        corpus.refetch();
      } catch {
        // Error is already set in the hook
      }
    },
    [sources, corpus]
  );

  // Delete a source by type + filename (used at home/project level where type is known per-item)
  const handleDeleteSourceByType = useCallback(
    async (type: ContextType, filename: string) => {
      try {
        const res = await apiFetch(`/api/corpus/${type}/sources/${encodeURIComponent(filename)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
        setConfirmDeleteHome(null);
        // Remove from local state immediately
        setAllSources((prev) => prev.filter((s) => !(s.type === type && s.filename === filename)));
        corpus.refetch();
        if (selectedType === type) sources.refetch();
      } catch {
        // Non-critical
      }
    },
    [corpus, sources, selectedType]
  );

  const handleImport = useCallback(
    async (sourcePath: string, types: ContextType[]) => {
      const res = await apiFetch('/api/corpus/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, types }),
      });
      if (!res.ok) throw new Error(`Import failed: ${res.status}`);
      corpus.refetch();
      sources.refetch();
      compiled.refetch();
    },
    [corpus, sources, compiled]
  );

  const handleUpdateCompiled = useCallback(
    async (content: string) => {
      await compiled.updateCompiled(content);
      corpus.refetch();
    },
    [compiled, corpus]
  );

  // Compile types: POST /api/corpus/:type/compile for each type, then refetch everything
  const handleCompileTypes = useCallback(
    async (types: ContextType[]) => {
      await Promise.all(
        types.map((type) =>
          apiFetch(`/api/corpus/${type}/compile`, { method: 'POST' }).catch(() => { /* non-critical */ })
        )
      );
      // Refresh corpus, sources, and compiled views
      corpus.refetch();
      sources.refetch();
      compiled.refetch();
    },
    [corpus, sources, compiled]
  );

  // Derive product name: prefer server-provided project name, fall back to contextRoot path
  const data = corpus.data;
  const productName = useMemo(() => {
    if (data?.project && data.project !== 'default') {
      return data.project;
    }
    const root = data?.contextRoot ?? '';
    const segments = root.split('/').filter(Boolean);
    // If the last segment is .contextual, use the parent directory name
    let segment = segments.pop() ?? 'Product';
    if (segment === '.contextual' && segments.length > 0) {
      segment = segments.pop()!;
    }
    // Convert kebab-case / snake_case to Title Case
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, [data?.project, data?.contextRoot]);

  // Adapter: ProjectDetail.onSelectType expects (type: string | null)
  const handleSelectTypeForProject = useCallback(
    (type: string | null) => {
      if (type && activeProject) {
        setSelection({ scope: activeProject, category: type as ContextType });
      }
    },
    [activeProject]
  );

  // Loading state
  if (corpus.isLoading && !corpus.data) {
    return (
      <main className="shell">
        <div className="loading">Loading context manager...</div>
      </main>
    );
  }

  const types = data?.types ?? [];

  return (
    <main className="shell">
      {/* Header bar */}
      <header className="cm-header">
        <div className="cm-header-left">
          <p className="eyebrow">Contextual</p>
          <h1>Context Manager</h1>
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="cm-layout">
        {/* Left sidebar: hierarchical tree */}
        <aside className="cm-sidebar">
          <CorpusTree
            types={types}
            productName={productName}
            projects={projects.projects}
            projectsLoading={projects.isLoading}
            selection={selection}
            onSelect={handleSelect}
          />
        </aside>

        {/* Center: paste zone + detail (compiled doc + sources) */}
        <section className="cm-center">
          {/* Home level: show product brief + add context + tabbed sources/passes */}
          {isHome && (
            <>
              <div className="cm-center-detail">
                <ProductBriefView />
                <PasteZone
                  onSubmit={handlePaste}
                  defaultType={selectedType ?? undefined}
                  onImport={() => setShowImport(true)}
                  onDiscover={() => setShowDiscover(true)}
                  onCompileTypes={handleCompileTypes}
                />
              </div>

              <div className="cm-center-detail">
                {/* Tab bar */}
                <div className="home-tabs">
                  <div className="home-tabs-bar">
                    <button
                      type="button"
                      className={`home-tab${homeTab === 'sources' ? ' active' : ''}`}
                      onClick={() => setHomeTab('sources')}
                    >
                      All Sources
                      <span className="home-tab-count">{allSources.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`home-tab${homeTab === 'passes' ? ' active' : ''}`}
                      onClick={() => setHomeTab('passes')}
                    >
                      Passes
                      <span className="home-tab-count">{allPasses.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`home-tab${homeTab === 'outcomes' ? ' active' : ''}`}
                      onClick={() => setHomeTab('outcomes')}
                    >
                      Outcomes
                      <span className="home-tab-count">{allOutcomes.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`home-tab${homeTab === 'next-steps' ? ' active' : ''}`}
                      onClick={() => setHomeTab('next-steps')}
                    >
                      Contextual Instructions
                    </button>
                  </div>

                  {homeTab === 'next-steps' && <NextStepsCard />}

                  {/* Sources tab */}
                  {homeTab === 'sources' && (
                    <div className="all-sources">
                      {allSourcesLoading ? (
                        <div className="loading">Loading sources...</div>
                      ) : allSources.length === 0 ? (
                        <div className="empty-state">
                          <p className="muted">No context added yet.</p>
                          <p className="muted" style={{ fontSize: '0.85rem' }}>
                            Drop files, paste content above, or add .md files to the context
                            folders directly. Changes are detected automatically.
                          </p>
                        </div>
                      ) : (
                        <div className="all-sources-list">
                          {allSources.map((item) => {
                            const itemKey = `${item.type}-${item.filename}`;
                            const isConfirming = confirmDeleteHome === itemKey;
                            return (
                              <div key={itemKey} className={`all-sources-item-row${isConfirming ? ' confirming' : ''}`}>
                                <button
                                  type="button"
                                  className="all-sources-item"
                                  onClick={() => setSelection({ scope: 'product', category: item.type })}
                                >
                                  <div className="all-sources-item-header">
                                    <span className="all-sources-item-type">
                                      {TYPE_LABELS[item.type]}
                                    </span>
                                    <span className="all-sources-item-name">{item.filename}</span>
                                  </div>
                                  {item.preview && (
                                    <div className="all-sources-item-preview">{item.preview}</div>
                                  )}
                                </button>
                                {!isConfirming ? (
                                  <button
                                    type="button"
                                    className="all-sources-item-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteHome(itemKey);
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
                                      onClick={() => setConfirmDeleteHome(null)}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="source-delete-confirm"
                                      onClick={() => handleDeleteSourceByType(item.type, item.filename)}
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
                    </div>
                  )}

                  {/* Passes tab */}
                  {homeTab === 'passes' && (
                    <div className="home-passes">
                      {allPassesLoading ? (
                        <div className="loading">Loading passes...</div>
                      ) : allPasses.length === 0 ? (
                        <div className="empty-state">
                          <p className="muted">No passes yet.</p>
                        </div>
                      ) : (
                        <div className="home-passes-list">
                          {allPasses.map((pass) => {
                            const isExpanded = expandedPasses.has(pass.id);
                            const instructions = pass.instructions ?? [];
                            const time = (() => {
                              try {
                                const d = new Date(pass.timestamp);
                                const diff = Date.now() - d.getTime();
                                const mins = Math.floor(diff / 60000);
                                if (mins < 1) return 'just now';
                                if (mins < 60) return `${mins}m ago`;
                                const hrs = Math.floor(mins / 60);
                                if (hrs < 24) return `${hrs}h ago`;
                                const days = Math.floor(hrs / 24);
                                if (days < 7) return `${days}d ago`;
                                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              } catch { return pass.timestamp; }
                            })();
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
                                  <span className="project-detail-pass-time">{time}</span>
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

                  {/* Outcomes tab */}
                  {homeTab === 'outcomes' && (
                    <div className="home-outcomes">
                      {allOutcomesLoading ? (
                        <div className="loading">Loading outcomes...</div>
                      ) : allOutcomes.length === 0 ? (
                        <div className="empty-state">
                          <p className="muted">No outcomes yet.</p>
                          <p className="muted" style={{ fontSize: '0.85rem' }}>
                            Outcomes are recorded when passes are reviewed and evaluated.
                          </p>
                        </div>
                      ) : (
                        <div className="home-outcomes-list">
                          {allOutcomes.map((outcome) => (
                            <OutcomeCard
                              key={outcome.id}
                              outcome={outcome}
                              showProject={true}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Project detail when a project is selected without a specific type */}
          {activeProject && !selectedType && (
            <div className="cm-center-detail">
              <ProjectDetail
                projectName={activeProject}
                onSelectType={handleSelectTypeForProject}
                onPaste={handlePaste}
                onDeleteSource={handleDeleteSourceByType}
              />
            </div>
          )}

          {/* Category detail: compiled doc + sources */}
          {selectedType && (
            <div className="cm-center-detail">
              <CompiledView
                type={selectedType}
                meta={compiled.meta}
                content={compiled.content}
                isLoading={compiled.isLoading}
                error={compiled.error}
                onUpdate={handleUpdateCompiled}
              />
              <PasteZone
                onSubmit={handlePaste}
                defaultType={selectedType ?? undefined}
                onImport={() => setShowImport(true)}
                onDiscover={() => setShowDiscover(true)}
                onCompileTypes={handleCompileTypes}
              />
              <SourceDrawer
                type={selectedType}
                sources={sources.sources}
                isLoading={sources.isLoading}
                error={sources.error}
                onAddSource={() => setShowAddSource(true)}
                onDeleteSource={handleDeleteSource}
                onViewSource={setViewingSource}
                passes={allPasses}
                passesLoading={allPassesLoading}
              />
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {showAddSource && selectedType && (
        <AddSourceModal
          type={selectedType}
          onSubmit={handleAddSource}
          onClose={() => setShowAddSource(false)}
        />
      )}

      {showImport && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {showDiscover && (
        <DiscoverModal
          onClose={() => setShowDiscover(false)}
          onImported={() => {
            corpus.refetch();
            sources.refetch();
            compiled.refetch();
          }}
        />
      )}
    </main>
  );
}
