// =============================================================================
// CorpusHealth
// =============================================================================
// Sidebar navigation with Home + flat list of context types with fill bars.
// Home = context-agnostic paste mode. Type rows show label, count, fill bar.
// =============================================================================

import type { CorpusTypeEntry } from '../hooks/useCorpus.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';

interface CorpusHealthProps {
  types: CorpusTypeEntry[];
  totalTokens: number;
  onSelectType: (type: string | null) => void;
  selectedType: string | null;
}

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

export function CorpusHealth({
  types,
  totalTokens,
  onSelectType,
  selectedType,
}: CorpusHealthProps) {
  // Find the max tokens for relative bar sizing
  const maxTokens = Math.max(1, ...types.map((t) => t.meta?.totalTokenEstimate ?? 0));
  const totalSources = types.reduce((sum, t) => sum + (t.sourceCount ?? 0), 0);

  return (
    <nav className="corpus-health">
      <div className="corpus-health-header">
        <h3>Corpus</h3>
        {totalTokens > 0 && (
          <span className="corpus-health-total muted">
            {formatTokens(totalTokens)} tokens
          </span>
        )}
      </div>

      <div className="corpus-nav-list">
        {/* Home: context-agnostic paste mode */}
        <button
          type="button"
          className={`corpus-nav-item corpus-nav-home ${selectedType === null ? 'selected' : ''}`}
          onClick={() => onSelectType(null)}
        >
          <div className="corpus-nav-item-top">
            <span className="corpus-nav-name">Home</span>
            <span className="corpus-nav-meta">
              {totalSources > 0 ? <>{totalSources} sources</> : <>paste anything</>}
            </span>
          </div>
        </button>

        <div className="corpus-nav-divider" />

        {types.map((entry) => {
          const tokens = entry.meta?.totalTokenEstimate ?? 0;
          const sources = entry.sourceCount ?? 0;
          const hasContent = entry.exists && entry.meta;
          const isSelected = selectedType === entry.type;
          const fillPct = maxTokens > 0 ? (tokens / maxTokens) * 100 : 0;

          return (
            <button
              key={entry.type}
              type="button"
              className={`corpus-nav-item ${isSelected ? 'selected' : ''} ${hasContent ? '' : 'empty'}`}
              onClick={() => onSelectType(entry.type)}
            >
              <div className="corpus-nav-item-top">
                <span className="corpus-nav-name">{TYPE_LABELS[entry.type]}</span>
                <span className="corpus-nav-meta">
                  {hasContent ? (
                    <>{formatTokens(tokens)} &middot; {sources} sources</>
                  ) : sources > 0 ? (
                    <>{sources} uncompiled</>
                  ) : (
                    <>empty</>
                  )}
                </span>
              </div>
              {hasContent && (
                <div className="corpus-nav-bar">
                  <div
                    className="corpus-nav-bar-fill"
                    style={{ width: `${Math.max(2, fillPct)}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
