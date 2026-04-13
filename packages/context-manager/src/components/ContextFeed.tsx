// =============================================================================
// ContextFeed
// =============================================================================
// Shows recent source additions across all context types, sorted by date.
// This is the Wispr-inspired "home feed" -- a chronological view of what's
// been added to the corpus, so the user can see accumulated content and
// spot-check where things landed.
// =============================================================================

import type { ContextType } from '../hooks/useCorpus.js';
import { TYPE_LABELS } from '../hooks/useCorpus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedItem {
  /** Source filename */
  filename: string;
  /** Which context type it belongs to */
  type: ContextType;
  /** Content preview (first ~200 chars) */
  preview: string;
  /** File size in bytes */
  size: number;
  /** When it was added */
  addedAt: string;
}

interface ContextFeedProps {
  items: FeedItem[];
  isLoading: boolean;
  onViewSource: (type: ContextType, filename: string) => void;
  /** When set, shows a filter label indicating the feed is scoped to a project */
  filterLabel?: string | null;
  /** Called when the user clicks the clear filter button */
  onClearFilter?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(iso).toLocaleDateString('en-US', {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContextFeed({ items, isLoading, onViewSource, filterLabel, onClearFilter }: ContextFeedProps) {
  if (isLoading) {
    return (
      <div className="context-feed">
        <div className="context-feed-header">
          <h3>Recent Activity</h3>
        </div>
        <div className="loading">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="context-feed">
      <div className="context-feed-header">
        <h3>Recent Activity</h3>
        <span className="context-feed-count muted">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filterLabel && (
        <div className="context-feed-filter">
          <span className="context-feed-filter-label">
            Filtered to <strong>{filterLabel}</strong>
          </span>
          {onClearFilter && (
            <button
              type="button"
              className="ghost small context-feed-filter-clear"
              onClick={onClearFilter}
            >
              Show all
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p className="muted">No context added yet.</p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Paste content above or import from an existing project to populate
            your corpus.
          </p>
        </div>
      ) : (
        <div className="context-feed-list">
          {items.map((item) => (
            <button
              key={`${item.type}-${item.filename}`}
              type="button"
              className="feed-item"
              onClick={() => onViewSource(item.type, item.filename)}
            >
              <div className="feed-item-header">
                <span className={`feed-item-type type-${item.type}`}>
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="feed-item-time">
                  {formatRelativeTime(item.addedAt)}
                </span>
              </div>
              <div className="feed-item-name">{item.filename}</div>
              {item.preview && (
                <div className="feed-item-preview">{item.preview}</div>
              )}
              <div className="feed-item-meta">
                <span>{formatSize(item.size)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
