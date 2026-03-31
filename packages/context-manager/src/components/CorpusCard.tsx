// =============================================================================
// CorpusCard
// =============================================================================
// Displays a single context type as a card in the dashboard grid.
// Shows: type label, description, token estimate, section count, source count.
// Clicking the card selects it to show the detail view.
// =============================================================================

import type { CorpusTypeEntry } from '../hooks/useCorpus.js';
import { TYPE_LABELS, TYPE_DESCRIPTIONS } from '../hooks/useCorpus.js';

interface CorpusCardProps {
  entry: CorpusTypeEntry;
  isSelected: boolean;
  onSelect: () => void;
}

function formatTokens(tokens: number): string {
  if (tokens === 0) return '0';
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

export function CorpusCard({ entry, isSelected, onSelect }: CorpusCardProps) {
  const label = TYPE_LABELS[entry.type];
  const description = TYPE_DESCRIPTIONS[entry.type];
  const hasContent = entry.exists && entry.meta;
  const sectionCount = entry.meta?.sections.length ?? 0;
  const tokenCount = entry.meta?.totalTokenEstimate ?? 0;

  return (
    <button
      type="button"
      className={`corpus-card ${isSelected ? 'selected' : ''} ${hasContent ? 'has-content' : 'empty'}`}
      onClick={onSelect}
    >
      <div className="corpus-card-header">
        <h3 className="corpus-card-title">{label}</h3>
        {hasContent && (
          <span className="corpus-card-badge">{formatTokens(tokenCount)} tokens</span>
        )}
      </div>

      <p className="corpus-card-description">{description}</p>

      <div className="corpus-card-stats">
        {hasContent ? (
          <>
            <span className="corpus-card-stat">
              {sectionCount} section{sectionCount !== 1 ? 's' : ''}
            </span>
            <span className="corpus-card-stat-divider" />
            <span className="corpus-card-stat">
              {entry.sourceCount} source{entry.sourceCount !== 1 ? 's' : ''}
            </span>
          </>
        ) : (
          <span className="corpus-card-stat empty-stat">
            {entry.sourceCount > 0
              ? `${entry.sourceCount} source${entry.sourceCount !== 1 ? 's' : ''} (not compiled)`
              : 'No content yet'}
          </span>
        )}
      </div>
    </button>
  );
}
