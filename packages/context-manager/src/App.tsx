// =============================================================================
// Context Manager - Dashboard App
// =============================================================================
// Single-view corpus manager. Shows all 7 context types as cards. Selecting a
// type shows its compiled content and raw sources. No wizard, no steps, no
// handoff file -- the filesystem IS the context.
// =============================================================================

import { useCallback, useState } from 'react';
import { useCorpus } from './hooks/useCorpus.js';
import { useSources } from './hooks/useSources.js';
import { useCompiledFile } from './hooks/useCompiledFile.js';
import { CorpusCard } from './components/CorpusCard.js';
import { SourceDrawer } from './components/SourceDrawer.js';
import { CompiledView } from './components/CompiledView.js';
import { AddSourceModal } from './components/AddSourceModal.js';
import { ImportModal } from './components/ImportModal.js';
import type { ContextType } from './hooks/useCorpus.js';

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

export function App() {
  const corpus = useCorpus();
  const [selectedType, setSelectedType] = useState<ContextType | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [_viewingSource, setViewingSource] = useState<string | null>(null);

  const sources = useSources({ type: selectedType });
  const compiled = useCompiledFile({ type: selectedType });

  const handleSelectType = useCallback(
    (type: ContextType) => {
      setSelectedType((prev) => (prev === type ? null : type));
      setViewingSource(null);
    },
    []
  );

  const handleAddSource = useCallback(
    async (content: string, label?: string) => {
      await sources.addSource(content, label);
      corpus.refetch();
    },
    [sources, corpus]
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

  const handleImport = useCallback(
    async (sourcePath: string, types: ContextType[]) => {
      const res = await fetch('/api/corpus/import', {
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

  // Loading state
  if (corpus.isLoading) {
    return (
      <main className="shell">
        <div className="loading">Loading context manager...</div>
      </main>
    );
  }

  const data = corpus.data;
  const types = data?.types ?? [];
  const typesWithContent = types.filter((t) => t.exists);
  const totalTokens = data?.totalTokenEstimate ?? 0;

  return (
    <main className="shell">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Context Manager</p>
          <h1>Corpus</h1>
          <p className="hero-copy">
            Your organizational context, organized by type. Add source material, review
            compiled context, and manage what the agent reads.
          </p>
        </div>
        <div className="dashboard-stats">
          <div className="stat-card">
            <span className="stat-label">Context Types</span>
            <strong>{typesWithContent.length} / {types.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Tokens</span>
            <strong>{formatTokens(totalTokens)}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Context Root</span>
            <strong className="stat-path">{data?.contextRoot ?? '—'}</strong>
          </div>
        </div>
      </header>

      {/* Global actions */}
      <div className="dashboard-actions">
        <button type="button" className="secondary" onClick={() => setShowImport(true)}>
          Import from Project
        </button>
        <button type="button" className="ghost" onClick={corpus.refetch}>
          Refresh
        </button>
        {corpus.error && <span className="error" style={{ fontSize: '0.85rem' }}>{corpus.error}</span>}
      </div>

      {/* Corpus grid */}
      <div className="corpus-grid">
        {types.map((entry) => (
          <CorpusCard
            key={entry.type}
            entry={entry}
            isSelected={selectedType === entry.type}
            onSelect={() => handleSelectType(entry.type)}
          />
        ))}
      </div>

      {/* Detail view: compiled content + sources for selected type */}
      {selectedType && (
        <div className="detail-panel">
          <div className="detail-main">
            <CompiledView
              type={selectedType}
              meta={compiled.meta}
              content={compiled.content}
              isLoading={compiled.isLoading}
              error={compiled.error}
              onUpdate={handleUpdateCompiled}
            />
          </div>
          <div className="detail-sidebar">
            <SourceDrawer
              type={selectedType}
              sources={sources.sources}
              isLoading={sources.isLoading}
              error={sources.error}
              onAddSource={() => setShowAddSource(true)}
              onDeleteSource={handleDeleteSource}
              onViewSource={setViewingSource}
            />
          </div>
        </div>
      )}

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
    </main>
  );
}
